import redaxios from "redaxios";
import { isRelativeDate, resolveRelativeDate, } from "./filters/relative-dates.js";
import { TSenseMigrator } from "./migrator.js";
import { defaultTransformers } from "./transformers/defaults.js";
function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}
const redaxiosInstance = redaxios.default ?? redaxios;
function escapeFilterValue(value) {
    if (typeof value === "string") {
        return `\`${value.replaceAll("`", "")}\``;
    }
    if (Array.isArray(value)) {
        return value.map(escapeFilterValue);
    }
    return value;
}
const filterOperators = {
    not: (k, v) => `${k}:!=${v}`,
    gt: (k, v) => `${k}:>${v}`,
    gte: (k, v) => `${k}:>=${v}`,
    lt: (k, v) => `${k}:<${v}`,
    lte: (k, v) => `${k}:<=${v}`,
    notIn: (k, v) => `${k}:!=[${v.join(",")}]`,
};
const arkToTsense = {
    string: "string",
    number: "float",
    "number.integer": "int64",
    "number % 1": "int64",
    boolean: "bool",
    "string[]": "string[]",
    "number[]": "float[]",
    "boolean[]": "bool[]",
};
export class TSense {
    options;
    fields = [];
    axios;
    synced = false;
    fieldTransformers = new Map();
    dataSyncConfig;
    infer = undefined;
    get name() {
        return this.options.name;
    }
    get defaultSortingField() {
        return this.options.defaultSortingField;
    }
    constructor(options) {
        this.options = options;
        this.axios = redaxiosInstance.create({
            baseURL: `${options.connection.protocol}://${options.connection.host}:${options.connection.port}`,
            headers: { "X-TYPESENSE-API-KEY": options.connection.apiKey },
        });
        this.fields = this.extractFields(options.transformers ?? defaultTransformers);
        this.dataSyncConfig = options.dataSync;
    }
    getBaseType(expression, domain) {
        if (domain && domain !== "undefined")
            return domain;
        return expression
            .split(" | ")
            .filter((branch) => branch !== "null" && branch !== "undefined")
            .join(" | ");
    }
    inferType(arkType, branches) {
        const direct = arkToTsense[arkType];
        if (direct)
            return direct;
        const domains = new Set(branches
            .map((branch) => branch.domain)
            .filter((domain) => domain && domain !== "null" && domain !== "undefined"));
        if (domains.size === 1) {
            const domain = domains.values().next().value;
            const inferred = domain ? arkToTsense[domain] : undefined;
            if (inferred)
                return inferred;
        }
        if (arkType.includes("[]")) {
            if (arkType.includes("'") || arkType.includes('"')) {
                return "string[]";
            }
            return "object[]";
        }
        if (arkType.includes("'") || arkType.includes('"'))
            return "string";
        if (arkType.includes("{") || arkType.includes("|"))
            return "object";
        return "string";
    }
    serializeDoc(doc) {
        const result = { ...doc };
        for (const key of Object.keys(result)) {
            if (result[key] == null) {
                delete result[key];
            }
        }
        for (const [field, transformer] of this.fieldTransformers) {
            if (result[field] != null) {
                result[field] = transformer.serialize(result[field]);
            }
        }
        return result;
    }
    deserializeDoc(doc) {
        for (const [field, transformer] of this.fieldTransformers) {
            if (doc[field] != null) {
                doc[field] = transformer.deserialize(doc[field]);
            }
        }
        return doc;
    }
    serializeFilterValue(key, value) {
        const transformer = this.fieldTransformers.get(key);
        if (!transformer)
            return value;
        if (Array.isArray(value)) {
            return value.map((v) => transformer.serialize(v));
        }
        if (typeof value === "object" &&
            value !== null &&
            Object.getPrototypeOf(value) === Object.prototype) {
            const result = {};
            for (const [opKey, opValue] of Object.entries(value)) {
                if (opValue == null) {
                    result[opKey] = opValue;
                    continue;
                }
                if (Array.isArray(opValue)) {
                    result[opKey] = opValue.map((item) => transformer.serialize(item));
                }
                else {
                    result[opKey] = transformer.serialize(opValue);
                }
            }
            return result;
        }
        return transformer.serialize(value);
    }
    extractFields(transformers) {
        const internal = this.options.schema;
        const fields = [];
        for (const prop of internal.structure.props) {
            const branches = prop.value.branches ?? [];
            const enumValues = [];
            for (const branch of branches) {
                if (typeof branch.unit === "string") {
                    enumValues.push(branch.unit);
                }
            }
            const innerType = branches[0] ?? prop.value;
            const meta = (innerType.meta ?? prop.value.meta);
            const expression = String(prop.value.expression);
            const domain = prop.value.domain;
            const baseType = this.getBaseType(expression, domain);
            const optional = prop.kind === "optional" ||
                branches.some((branch) => branch.domain === "null" || branch.domain === "undefined");
            const transformer = transformers.find((t) => t.match(expression, domain) || t.match(baseType, domain));
            if (transformer) {
                this.fieldTransformers.set(prop.key, transformer);
                fields.push({
                    name: prop.key,
                    type: transformer.storageType,
                    sourceExpression: expression,
                    optional,
                    facet: meta?.facet,
                    sort: meta?.sort,
                    index: meta?.index,
                    enumValues,
                });
                continue;
            }
            const type = meta?.type ?? this.inferType(baseType, branches);
            fields.push({
                name: prop.key,
                type,
                sourceExpression: expression,
                optional,
                facet: meta?.facet,
                sort: meta?.sort,
                index: meta?.index,
                enumValues,
            });
        }
        return fields;
    }
    async ensureSynced(force) {
        if (!force && (this.synced || !this.options.autoSyncSchema))
            return;
        await new TSenseMigrator(this.options.name, this.fields, this.options.defaultSortingField, this.axios).sync();
        this.synced = true;
    }
    async syncSchema() {
        await this.ensureSynced(true);
    }
    async inspectSchema() {
        return await new TSenseMigrator(this.options.name, this.fields, this.options.defaultSortingField, this.axios).inspect();
    }
    async retrieve() {
        const { data } = await this.axios({
            method: "GET",
            url: `/collections/${this.options.name}`,
        }).catch((err) => {
            if (err.status === 404) {
                return { data: null };
            }
            throw err;
        });
        return data;
    }
    async health() {
        const { data } = await this.axios({
            method: "GET",
            url: "/health",
        }).catch(() => ({ data: { ok: false } }));
        return data.ok;
    }
    async upsertSynonym(id, synonym) {
        await this.axios({
            method: "PUT",
            url: `/collections/${this.options.name}/synonyms/${id}`,
            data: synonym,
        });
    }
    buildObjectFilter(key, value) {
        if (value.gte != null && value.lte != null) {
            const escaped = escapeFilterValue(value.gte);
            const escapedLte = escapeFilterValue(value.lte);
            const parts = [`${key}:[${escaped}..${escapedLte}]`];
            for (const [op, opValue] of Object.entries(value)) {
                if (op === "gte" || op === "lte" || opValue == null)
                    continue;
                const builder = filterOperators[op];
                if (builder) {
                    parts.push(builder(key, escapeFilterValue(opValue)));
                }
            }
            return parts;
        }
        const parts = [];
        for (const [op, opValue] of Object.entries(value)) {
            const builder = filterOperators[op];
            if (builder && op === "not" && opValue === null) {
                parts.push(builder(key, opValue));
                continue;
            }
            if (builder && opValue != null) {
                parts.push(builder(key, escapeFilterValue(opValue)));
            }
        }
        return parts;
    }
    buildFilter(filter) {
        const result = [];
        for (const entry of Object.entries(filter ?? {})) {
            const [key, rawValue] = entry;
            if (rawValue == null)
                continue;
            if (key === "OR") {
                const orParts = [];
                for (const condition of rawValue) {
                    const inner = this.buildFilter(condition);
                    if (!inner.length) {
                        continue;
                    }
                    orParts.push(`(${inner.join("&&")})`);
                }
                if (!orParts.length) {
                    continue;
                }
                result.push(`(${orParts.join("||")})`);
                continue;
            }
            const value = this.serializeFilterValue(key, rawValue);
            const escaped = escapeFilterValue(value);
            if (typeof escaped === "string" ||
                typeof escaped === "number" ||
                typeof escaped === "boolean") {
                result.push(`${key}:=${escaped}`);
                continue;
            }
            if (Array.isArray(escaped)) {
                result.push(`${key}:[${escaped.join(",")}]`);
                continue;
            }
            if (typeof value === "object" && value !== null) {
                result.push(...this.buildObjectFilter(key, value));
            }
        }
        return result;
    }
    validateFilterFields(filter) {
        if (!filter) {
            return;
        }
        const fields = [];
        for (const [key, value] of Object.entries(filter)) {
            if (value == null) {
                continue;
            }
            if (key === "OR") {
                for (const condition of value) {
                    this.validateFilterFields(condition);
                }
                continue;
            }
            fields.push(key);
        }
        if (!fields.length) {
            return;
        }
        this.validateFields(fields);
    }
    validateFields(fields) {
        const valid = new Set(this.fields.map((f) => f.name));
        for (const field of fields) {
            if (field !== "score" && !valid.has(field)) {
                throw new Error(`INVALID_FIELD: ${field}`);
            }
        }
    }
    resolveFilterValue(value) {
        if (isRelativeDate(value)) {
            return resolveRelativeDate(value, this.options.timezone);
        }
        if (Array.isArray(value)) {
            return value.map((v) => isRelativeDate(v) ? resolveRelativeDate(v, this.options.timezone) : v);
        }
        if (typeof value === "object" &&
            value !== null &&
            !(value instanceof Date)) {
            const result = {};
            for (const [k, v] of Object.entries(value)) {
                result[k] = this.resolveFilterValue(v);
            }
            return result;
        }
        return value;
    }
    resolveFilterDates(filter) {
        if (!filter || !this.options.timezone) {
            return filter;
        }
        const result = {};
        for (const [key, value] of Object.entries(filter)) {
            if (value == null) {
                continue;
            }
            if (key === "OR") {
                result.OR = value.map((f) => this.resolveFilterDates(f));
                continue;
            }
            result[key] = this.resolveFilterValue(value);
        }
        return result;
    }
    buildFilterExpression(filter) {
        const resolved = this.resolveFilterDates(filter);
        this.validateFilterFields(resolved);
        const parts = this.buildFilter(resolved);
        if (!parts.length) {
            return;
        }
        return `(${parts.join("&&")})`;
    }
    combineFilterExpressions(...filters) {
        return filters
            .map((filter) => this.buildFilterExpression(filter))
            .filter((filter) => filter != null)
            .join("&&");
    }
    buildSort(options) {
        if (!options.sortBy)
            return;
        const result = [];
        for (const item of options.sortBy) {
            const [field, direction] = item.split(":");
            if (field === "undefined")
                continue;
            const realField = field === "score" ? "_text_match" : field;
            result.push(`${realField}:${direction}`);
        }
        return result.join(",");
    }
    async create() {
        const enableNested = this.fields.some((f) => f.type === "object" || f.type === "object[]");
        await this.axios({
            method: "POST",
            url: "/collections",
            data: {
                name: this.options.name,
                fields: this.fields,
                default_sorting_field: this.options.defaultSortingField,
                enable_nested_fields: enableNested,
            },
        });
        return this;
    }
    async drop() {
        await this.axios({
            method: "DELETE",
            url: `/collections/${this.options.name}`,
        });
    }
    async recreate() {
        await this.drop().catch((err) => {
            if (err.status !== 404) {
                throw err;
            }
        });
        await this.create();
    }
    async get(id) {
        await this.ensureSynced();
        const { data } = await this.axios({
            method: "GET",
            url: `/collections/${this.options.name}/documents/${id}`,
        }).catch((e) => {
            if (e.status === 404)
                return { data: null };
            throw e;
        });
        return data ? this.deserializeDoc(data) : null;
    }
    async delete(id) {
        await this.ensureSynced();
        const { data } = await this.axios({
            method: "DELETE",
            url: `/collections/${this.options.name}/documents/${id}`,
        }).catch((e) => {
            if (e.status === 404)
                return { data: null };
            throw e;
        });
        return data != null;
    }
    async deleteIds(ids) {
        if (!ids.length) {
            return 0;
        }
        await this.ensureSynced();
        const values = ids.map(escapeFilterValue).join(",");
        const { data } = await this.axios({
            method: "DELETE",
            url: `/collections/${this.options.name}/documents`,
            params: { filter_by: `id:[${values}]` },
        });
        return data.num_deleted;
    }
    async deleteManyWithFilterBy(filterBy) {
        await this.ensureSynced();
        if (!filterBy) {
            throw new Error("FILTER_REQUIRED");
        }
        const { data } = await this.axios({
            method: "DELETE",
            url: `/collections/${this.options.name}/documents`,
            params: { filter_by: filterBy },
        });
        return { deleted: data.num_deleted };
    }
    async deleteMany(filter) {
        return await this.deleteManyWithFilterBy(this.combineFilterExpressions(filter));
    }
    async update(id, data) {
        await this.ensureSynced();
        const serialized = this.serializeDoc(data);
        const { data: updated } = await this.axios({
            method: "PATCH",
            url: `/collections/${this.options.name}/documents/${id}`,
            data: serialized,
        });
        return this.deserializeDoc(updated);
    }
    async updateManyWithFilterBy(filterBy, data) {
        await this.ensureSynced();
        if (!filterBy) {
            throw new Error("FILTER_REQUIRED");
        }
        const serialized = this.serializeDoc(data);
        const { data: result } = await this.axios({
            method: "PATCH",
            url: `/collections/${this.options.name}/documents`,
            params: { filter_by: filterBy },
            data: serialized,
        });
        return { updated: result.num_updated };
    }
    async updateMany(filter, data) {
        return await this.updateManyWithFilterBy(this.combineFilterExpressions(filter), data);
    }
    async search(options) {
        return await this.executeSearch(options, this.combineFilterExpressions(options.filter));
    }
    async executeSearch(options, filterBy) {
        await this.ensureSynced();
        const queryByFields = options.queryBy ?? [
            this.options.defaultSearchField,
        ];
        this.validateFields(queryByFields);
        if (options.sortBy) {
            this.validateFields(options.sortBy
                .map((s) => s.split(":")[0])
                .filter((f) => f !== "undefined"));
        }
        if (options.facetBy) {
            this.validateFields(options.facetBy);
        }
        const queryBy = queryByFields.join(",");
        const params = {
            q: options.query ?? "*",
            query_by: queryBy,
        };
        const sortBy = this.buildSort(options);
        if (sortBy)
            params.sort_by = sortBy;
        const combinedFilter = [filterBy, ...(options.rawFilter ?? [])]
            .filter((part) => part.length)
            .join("&&");
        if (combinedFilter)
            params.filter_by = combinedFilter;
        if (options.page != null)
            params.page = options.page;
        if (options.limit != null)
            params.per_page = options.limit;
        const facetBy = options.facetBy?.join(",");
        if (facetBy)
            params.facet_by = facetBy;
        if (options.exhaustiveSearch != null) {
            params.exhaustive_search = options.exhaustiveSearch;
        }
        if ("pick" in options && options.pick) {
            params.include_fields = options.pick.join(",");
        }
        if ("omit" in options && options.omit) {
            params.exclude_fields = options.omit.join(",");
        }
        const highlight = options.highlight;
        const highlightOpts = typeof highlight === "object" ? highlight : undefined;
        if (highlightOpts) {
            if (highlightOpts.fields) {
                params.highlight_fields = highlightOpts.fields.join(",");
            }
            if (highlightOpts.startTag) {
                params.highlight_start_tag = highlightOpts.startTag;
            }
            if (highlightOpts.endTag) {
                params.highlight_end_tag = highlightOpts.endTag;
            }
        }
        const { data: res } = await this.axios({
            method: "GET",
            url: `/collections/${this.options.name}/documents/search`,
            params,
        });
        const data = [];
        const scores = [];
        for (const hit of res.hits ?? []) {
            if (highlight) {
                const fieldsToHighlight = highlightOpts?.fields;
                for (const [key, value] of Object.entries(hit.highlight ?? {})) {
                    if (!value?.snippet)
                        continue;
                    if (fieldsToHighlight && !fieldsToHighlight.includes(key))
                        continue;
                    hit.document[key] = value.snippet;
                }
            }
            const doc = this.deserializeDoc(hit.document);
            data.push(doc);
            scores.push(hit.text_match ?? 0);
        }
        const facets = {};
        for (const facetCount of res.facet_counts ?? []) {
            const fieldName = facetCount.field_name;
            facets[fieldName] = {};
            for (const item of facetCount.counts) {
                facets[fieldName][item.value] = item.count;
            }
        }
        return {
            count: res.found,
            data,
            facets,
            scores,
        };
    }
    async groupedSearch(options) {
        await this.ensureSynced();
        const queryByFields = options.queryBy ?? [
            this.options.defaultSearchField,
        ];
        const groupByFields = Array.isArray(options.groupBy)
            ? options.groupBy
            : [options.groupBy];
        this.validateFields([...queryByFields, ...groupByFields]);
        const filterBy = this.combineFilterExpressions(options.filter);
        const combinedFilter = [filterBy, ...(options.rawFilter ?? [])]
            .filter((part) => part.length)
            .join("&&");
        const params = {
            q: options.query ?? "*",
            query_by: queryByFields.join(","),
            group_by: groupByFields.join(","),
            group_limit: options.groupLimit,
        };
        const sortBy = this.buildSort(options);
        if (sortBy)
            params.sort_by = sortBy;
        if (combinedFilter)
            params.filter_by = combinedFilter;
        if (options.page != null)
            params.page = options.page;
        if (options.limit != null)
            params.per_page = options.limit;
        if (options.exhaustiveSearch != null) {
            params.exhaustive_search = options.exhaustiveSearch;
        }
        const { data } = await this.axios({
            method: "GET",
            url: `/collections/${this.options.name}/documents/search`,
            params,
        });
        return {
            groups: data.grouped_hits?.map((group) => ({
                keys: group.group_key.map(String),
                count: group.found ?? 0,
                data: group.hits.map((hit) => this.deserializeDoc(hit.document)),
            })) ?? [],
            count: data.found,
        };
    }
    async searchListWithFilterBy(options, filterBy) {
        const page = options.cursor ? Number(options.cursor) : 1;
        const limit = Math.min(options.limit ?? 20, 100);
        const result = await this.executeSearch({
            query: options.query,
            queryBy: options.queryBy,
            sortBy: [options.sortBy],
            page,
            limit,
        }, filterBy);
        const hasMore = page * limit < result.count;
        return {
            data: result.data,
            nextCursor: hasMore ? String(page + 1) : null,
            total: result.count,
        };
    }
    async searchList(options) {
        return await this.searchListWithFilterBy(options, this.combineFilterExpressions(options.filter));
    }
    async countWithFilterBy(filterBy) {
        await this.ensureSynced();
        if (!filterBy) {
            const { data } = await this.axios({
                method: "GET",
                url: `/collections/${this.options.name}`,
            });
            return data.num_documents;
        }
        const params = {
            q: "*",
            query_by: this.options.defaultSearchField,
            per_page: 0,
            filter_by: filterBy,
        };
        const { data } = await this.axios({
            method: "GET",
            url: `/collections/${this.options.name}/documents/search`,
            params,
        });
        return data.found;
    }
    async count(filter) {
        return await this.countWithFilterBy(this.combineFilterExpressions(filter));
    }
    async upsert(docs) {
        await this.ensureSynced();
        const items = Array.isArray(docs) ? docs : [docs];
        if (!items.length)
            return [];
        const serialized = items.map((item) => this.serializeDoc(item));
        if (this.options.validateOnUpsert) {
            for (const item of serialized) {
                this.options.schema.assert(item);
            }
        }
        const payload = serialized.map((item) => JSON.stringify(item)).join("\n");
        const params = { action: "upsert" };
        if (this.options.batchSize) {
            params.batch_size = this.options.batchSize;
        }
        const { data } = await this.axios({
            method: "POST",
            url: `/collections/${this.options.name}/documents/import`,
            headers: { "Content-Type": "text/plain" },
            params,
            data: payload,
        });
        const results = typeof data === "string"
            ? data.split("\n").map((value) => JSON.parse(value))
            : [data];
        const failed = results.find((result) => !result.success);
        if (failed) {
            throw new Error(failed.error ?? "DOCUMENT_IMPORT_FAILED");
        }
        return results;
    }
    async syncData(options) {
        if (!this.dataSyncConfig) {
            throw new Error("DATA_SYNC_NOT_CONFIGURED");
        }
        const chunkSize = options?.chunkSize ?? this.dataSyncConfig.chunkSize ?? 500;
        const ids = options?.ids ?? (await this.dataSyncConfig.getAllIds());
        let upserted = 0;
        let deleted = 0;
        for (const chunk of chunkArray(ids, chunkSize)) {
            const items = await this.dataSyncConfig.getItems(chunk);
            const results = await this.upsert(items);
            const itemIds = new Set(items.map((item) => item.id));
            const missing = chunk.filter((id) => !itemIds.has(id));
            if (missing.length) {
                deleted += await this.deleteIds(missing);
            }
            for (const r of results) {
                if (r.success)
                    upserted++;
            }
        }
        if (options?.purge) {
            deleted += await this.purgeOrphans(ids, chunkSize);
        }
        return { upserted, deleted, failed: 0 };
    }
    async purgeOrphans(validIds, chunkSize) {
        const validSet = new Set(validIds);
        const remoteIds = await this.exportIds();
        const orphans = remoteIds.filter((id) => !validSet.has(id));
        if (!orphans.length)
            return 0;
        let deleted = 0;
        for (const chunk of chunkArray(orphans, chunkSize)) {
            deleted += await this.deleteIds(chunk);
        }
        return deleted;
    }
    async exportIds() {
        const { data } = await this.axios({
            method: "GET",
            url: `/collections/${this.options.name}/documents/export`,
            params: { include_fields: "id" },
        });
        return data
            .split("\n")
            .filter((line) => line.length)
            .map((line) => JSON.parse(line).id);
    }
    scoped(baseFilter) {
        return {
            search: (options) => this.executeSearch(options, this.combineFilterExpressions(baseFilter, options.filter)),
            searchList: (options) => this.searchListWithFilterBy(options, this.combineFilterExpressions(baseFilter, options.filter)),
            count: (filter) => this.countWithFilterBy(this.combineFilterExpressions(baseFilter, filter)),
            deleteMany: (filter) => this.deleteManyWithFilterBy(this.combineFilterExpressions(baseFilter, filter)),
            updateMany: (filter, data) => this.updateManyWithFilterBy(this.combineFilterExpressions(baseFilter, filter), data),
        };
    }
}
