import type { Type } from "arktype";
import redaxios from "redaxios";
import type { TsenseFieldMeta, TsenseFieldType } from "./env.js";
import { TSenseMigrator } from "./migrator.js";
import { defaultTransformers } from "./transformers/defaults.js";
import type { FieldTransformer } from "./transformers/types.js";
import type {
  DeleteResult,
  FieldSchema,
  FilterFor,
  ProjectSearch,
  ScopedCollection,
  SearchApiResponse,
  SearchListOptions,
  SearchListResult,
  SearchOptions,
  SearchOptionsPlain,
  SearchResult,
  SyncConfig,
  SyncOptions,
  SyncResult,
  TsenseOptions,
  UpdateResult,
  UpsertResult,
} from "./types.js";

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

const redaxiosInstance = redaxios.default ?? redaxios;

function escapeFilterValue(value: unknown): unknown {
  if (typeof value === "string") {
    return `\`${value.replaceAll("`", "")}\``;
  }

  if (Array.isArray(value)) {
    return value.map(escapeFilterValue);
  }

  return value;
}

const filterOperators: Record<string, (key: string, value: unknown) => string> =
  {
    not: (k, v) => `${k}:!=${v}`,
    gt: (k, v) => `${k}:>${v}`,
    gte: (k, v) => `${k}:>=${v}`,
    lt: (k, v) => `${k}:<${v}`,
    lte: (k, v) => `${k}:<=${v}`,
    notIn: (k, v) => `${k}:!=[${(v as unknown[]).join(",")}]`,
  };

const arkToTsense: Record<string, TsenseFieldMeta["type"]> = {
  string: "string",
  number: "float",
  "number.integer": "int64",
  "number % 1": "int64",
  boolean: "bool",
  "string[]": "string[]",
  "number[]": "float[]",
  "boolean[]": "bool[]",
};

export type AxiosInstance = ReturnType<typeof redaxiosInstance.create>;

export class TSense<T extends Type> {
  readonly fields: readonly FieldSchema[] = [];
  private axios: AxiosInstance;
  private synced = false;
  private fieldTransformers = new Map<string, FieldTransformer>();
  private dataSyncConfig?: SyncConfig<T["infer"]>;

  infer: T["infer"] = undefined;

  constructor(private options: TsenseOptions<T>) {
    this.axios = redaxiosInstance.create({
      baseURL: `${options.connection.protocol}://${options.connection.host}:${options.connection.port}`,
      headers: { "X-TYPESENSE-API-KEY": options.connection.apiKey },
    });

    this.fields = this.extractFields(
      options.transformers ?? defaultTransformers,
    );
    this.dataSyncConfig = options.dataSync;
  }

  private getBaseType(expression: string, domain?: string): string {
    if (domain && domain !== "undefined") return domain;
    return expression.replace(/ \| undefined$/, "");
  }

  private inferType(arkType: string): TsenseFieldType {
    const direct = arkToTsense[arkType];

    if (direct) return direct;
    if (arkType.includes("[]")) return "object[]";
    if (arkType.includes("'") || arkType.includes('"')) return "string";
    if (arkType.includes("{") || arkType.includes("|")) return "object";

    return "string";
  }

  private serializeDoc(doc: T["infer"]): Record<string, unknown> {
    const result = { ...(doc as Record<string, unknown>) };

    for (const [field, transformer] of this.fieldTransformers) {
      if (result[field] != null) {
        result[field] = transformer.serialize(result[field]);
      }
    }

    return result;
  }

  private deserializeDoc(doc: Record<string, unknown>): T["infer"] {
    for (const [field, transformer] of this.fieldTransformers) {
      if (doc[field] != null) {
        doc[field] = transformer.deserialize(doc[field]);
      }
    }

    return doc as T["infer"];
  }

  private serializeFilterValue(key: string, value: unknown): unknown {
    const transformer = this.fieldTransformers.get(key);

    if (!transformer) return value;

    if (Array.isArray(value)) {
      return value.map((v) => transformer.serialize(v));
    }

    if (
      typeof value === "object" &&
      value !== null &&
      Object.getPrototypeOf(value) === Object.prototype
    ) {
      const result: Record<string, unknown> = {};

      for (const [opKey, opValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        if (opValue == null) {
          result[opKey] = opValue;
          continue;
        }

        if (Array.isArray(opValue)) {
          result[opKey] = opValue.map((item) => transformer.serialize(item));
        } else {
          result[opKey] = transformer.serialize(opValue);
        }
      }

      return result;
    }

    return transformer.serialize(value);
  }

  private extractFields(transformers: FieldTransformer[]) {
    const internal = this.options.schema as unknown as {
      structure: {
        props: {
          key: string;
          kind: "required" | "optional";
          value: {
            expression: string;
            domain?: string;
            meta?: unknown;
            branches?: { domain?: string; meta?: unknown; unit?: unknown }[];
          };
        }[];
      };
    };

    const fields: FieldSchema[] = [];

    for (const prop of internal.structure.props) {
      const branches = prop.value.branches ?? [];

      const enumValues: string[] = [];

      for (const branch of branches) {
        if (typeof branch.unit === "string") {
          enumValues.push(branch.unit);
        }
      }

      const innerType = branches[0] ?? prop.value;
      const meta = (innerType.meta ?? prop.value.meta) as
        | TsenseFieldMeta
        | undefined;
      const expression = String(prop.value.expression);
      const domain = prop.value.domain;
      const baseType = this.getBaseType(expression, domain);

      const transformer = transformers.find(
        (t) => t.match(expression, domain) || t.match(baseType, domain),
      );

      if (transformer) {
        this.fieldTransformers.set(prop.key, transformer);
        fields.push({
          name: prop.key,
          type: transformer.storageType,
          sourceExpression: expression,
          optional: prop.kind === "optional",
          facet: meta?.facet,
          sort: meta?.sort,
          index: meta?.index,
          enumValues,
        });
        continue;
      }

      const type = meta?.type ?? this.inferType(baseType);

      fields.push({
        name: prop.key,
        type,
        sourceExpression: expression,
        optional: prop.kind === "optional",
        facet: meta?.facet,
        sort: meta?.sort,
        index: meta?.index,
        enumValues,
      });
    }

    return fields;
  }

  private async ensureSynced(force?: boolean): Promise<void> {
    if (!force && (this.synced || !this.options.autoSyncSchema)) return;

    await new TSenseMigrator(
      this.options.name,
      this.fields,
      this.options.defaultSortingField as string | undefined,
      this.axios,
    ).sync();

    this.synced = true;
  }

  async syncSchema(): Promise<void> {
    await this.ensureSynced(true);
  }

  private buildObjectFilter(
    key: string,
    value: Record<string, unknown>,
  ): string[] {
    if (value.gte != null && value.lte != null) {
      const escaped = escapeFilterValue(value.gte);
      const escapedLte = escapeFilterValue(value.lte);
      const parts = [`${key}:[${escaped}..${escapedLte}]`];

      for (const [op, opValue] of Object.entries(value)) {
        if (op === "gte" || op === "lte" || opValue == null) continue;

        const builder = filterOperators[op];

        if (builder) {
          parts.push(builder(key, escapeFilterValue(opValue)));
        }
      }

      return parts;
    }

    const parts: string[] = [];

    for (const [op, opValue] of Object.entries(value)) {
      if (opValue == null) continue;

      const builder = filterOperators[op];

      if (builder) {
        parts.push(builder(key, escapeFilterValue(opValue)));
      }
    }

    return parts;
  }

  private buildFilter(filter: FilterFor<T["infer"]> | undefined): string[] {
    const result: string[] = [];

    for (const entry of Object.entries(filter ?? {})) {
      const [key, rawValue] = entry as [string, unknown];

      if (rawValue == null) continue;

      if (key === "OR") {
        const orParts: string[] = [];

        for (const condition of rawValue as FilterFor<T["infer"]>[]) {
          const inner = this.buildFilter(condition);
          orParts.push(`(${inner.join("&&")})`);
        }

        result.push(`(${orParts.join("||")})`);
        continue;
      }

      const value = this.serializeFilterValue(key, rawValue);
      const escaped = escapeFilterValue(value);

      if (
        typeof escaped === "string" ||
        typeof escaped === "number" ||
        typeof escaped === "boolean"
      ) {
        result.push(`${key}:=${escaped}`);
        continue;
      }

      if (Array.isArray(escaped)) {
        result.push(`${key}:[${escaped.join(",")}]`);
        continue;
      }

      if (typeof value === "object" && value !== null) {
        result.push(
          ...this.buildObjectFilter(key, value as Record<string, unknown>),
        );
      }
    }

    return result;
  }

  private validateFields(fields: string[]) {
    const valid = new Set(this.fields.map((f) => f.name));

    for (const field of fields) {
      if (field !== "score" && !valid.has(field)) {
        throw new Error(`INVALID_FIELD: ${field}`);
      }
    }
  }

  private buildSort(options: SearchOptions<T["infer"]>) {
    if (!options.sortBy) return;

    const result: string[] = [];

    for (const item of options.sortBy) {
      const [field, direction] = item.split(":") as [string, "asc" | "desc"];

      if (field === "undefined") continue;

      const realField = field === "score" ? "_text_match" : field;
      result.push(`${realField}:${direction}`);
    }

    return result.join(",");
  }

  async create(): Promise<this> {
    const enableNested = this.fields.some(
      (f) => f.type === "object" || f.type === "object[]",
    );

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

  async drop(): Promise<void> {
    await this.axios({
      method: "DELETE",
      url: `/collections/${this.options.name}`,
    });
  }

  async get(id: string): Promise<T["infer"] | null> {
    await this.ensureSynced();

    const { data } = await this.axios<Record<string, unknown>>({
      method: "GET",
      url: `/collections/${this.options.name}/documents/${id}`,
    }).catch((e: { status?: number }) => {
      if (e.status === 404) return { data: null };
      throw e;
    });

    return data ? this.deserializeDoc(data) : null;
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureSynced();

    const { data } = await this.axios<T["infer"]>({
      method: "DELETE",
      url: `/collections/${this.options.name}/documents/${id}`,
    }).catch((e: { status?: number }) => {
      if (e.status === 404) return { data: null };
      throw e;
    });

    return data != null;
  }

  async deleteMany(filter: FilterFor<T["infer"]>): Promise<DeleteResult> {
    await this.ensureSynced();

    const filterBy = this.buildFilter(filter).join("&&");

    if (!filterBy) {
      throw new Error("FILTER_REQUIRED");
    }

    const { data } = await this.axios<{ num_deleted: number }>({
      method: "DELETE",
      url: `/collections/${this.options.name}/documents`,
      params: { filter_by: filterBy },
    });

    return { deleted: data.num_deleted };
  }

  async update(id: string, data: Partial<T["infer"]>): Promise<T["infer"]> {
    await this.ensureSynced();

    const serialized = this.serializeDoc(data as T["infer"]);

    const { data: updated } = await this.axios<Record<string, unknown>>({
      method: "PATCH",
      url: `/collections/${this.options.name}/documents/${id}`,
      data: serialized,
    });

    return this.deserializeDoc(updated);
  }

  async updateMany(
    filter: FilterFor<T["infer"]>,
    data: Partial<T["infer"]>,
  ): Promise<UpdateResult> {
    await this.ensureSynced();

    const filterBy = this.buildFilter(filter).join("&&");

    if (!filterBy) {
      throw new Error("FILTER_REQUIRED");
    }

    const serialized = this.serializeDoc(data as T["infer"]);

    const { data: result } = await this.axios<{ num_updated: number }>({
      method: "PATCH",
      url: `/collections/${this.options.name}/documents`,
      params: { filter_by: filterBy },
      data: serialized,
    });

    return { updated: result.num_updated };
  }

  async search<
    const O extends SearchOptions<T["infer"]> = SearchOptionsPlain<T["infer"]>,
  >(options: O): Promise<SearchResult<ProjectSearch<T["infer"], O>>> {
    await this.ensureSynced();

    const queryByFields = (options.queryBy as string[]) ?? [
      this.options.defaultSearchField as string,
    ];

    this.validateFields(queryByFields);

    if (options.sortBy) {
      this.validateFields(
        (options.sortBy as string[])
          .map((s) => s.split(":")[0]!)
          .filter((f) => f !== "undefined"),
      );
    }

    if (options.facetBy) {
      this.validateFields(options.facetBy as string[]);
    }

    const queryBy = queryByFields.join(",");

    const params: Record<string, unknown> = {
      q: options.query ?? "*",
      query_by: queryBy,
    };

    const sortBy = this.buildSort(options);
    if (sortBy) params.sort_by = sortBy;

    const filterBy = this.buildFilter(options.filter).join("&&");
    if (filterBy) params.filter_by = filterBy;

    if (options.page != null) params.page = options.page;
    if (options.limit != null) params.per_page = options.limit;

    const facetBy = (options.facetBy as string[])?.join(",");
    if (facetBy) params.facet_by = facetBy;

    if ("pick" in options && options.pick) {
      params.include_fields = (options.pick as readonly string[]).join(",");
    }

    if ("omit" in options && options.omit) {
      params.exclude_fields = (options.omit as readonly string[]).join(",");
    }

    const highlight = options.highlight;
    const highlightOpts = typeof highlight === "object" ? highlight : undefined;

    if (highlightOpts) {
      if (highlightOpts.fields) {
        params.highlight_fields = (highlightOpts.fields as string[]).join(",");
      }
      if (highlightOpts.startTag) {
        params.highlight_start_tag = highlightOpts.startTag;
      }
      if (highlightOpts.endTag) {
        params.highlight_end_tag = highlightOpts.endTag;
      }
    }

    const { data: res } = await this.axios<SearchApiResponse<T["infer"]>>({
      method: "GET",
      url: `/collections/${this.options.name}/documents/search`,
      params,
    });

    const data: T["infer"][] = [];
    const scores: number[] = [];

    for (const hit of res.hits ?? []) {
      if (highlight) {
        const fieldsToHighlight = highlightOpts?.fields as string[] | undefined;

        for (const [key, value] of Object.entries(hit.highlight ?? {})) {
          if (!value?.snippet) continue;
          if (fieldsToHighlight && !fieldsToHighlight.includes(key)) continue;

          (hit.document as Record<string, unknown>)[key] = value.snippet;
        }
      }

      const doc = this.deserializeDoc(hit.document as Record<string, unknown>);
      data.push(doc);
      scores.push(hit.text_match ?? 0);
    }

    const facets: Record<string, Record<string, number>> = {};

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
    } as SearchResult<ProjectSearch<T["infer"], O>>;
  }

  async searchList(
    options: SearchListOptions<T["infer"]>,
  ): Promise<SearchListResult<T["infer"]>> {
    const page = options.cursor ? Number(options.cursor) : 1;
    const limit = Math.min(options.limit ?? 20, 100);

    const result = await this.search({
      query: options.query,
      queryBy: options.queryBy,
      filter: options.filter,
      sortBy: [options.sortBy],
      page,
      limit,
    });

    const hasMore = page * limit < result.count;

    return {
      data: result.data,
      nextCursor: hasMore ? String(page + 1) : null,
      total: result.count,
    };
  }

  async count(filter?: FilterFor<T["infer"]>): Promise<number> {
    await this.ensureSynced();

    const filterBy = this.buildFilter(filter).join("&&");

    if (!filterBy) {
      const { data } = await this.axios<{ num_documents: number }>({
        method: "GET",
        url: `/collections/${this.options.name}`,
      });

      return data.num_documents;
    }

    const params: Record<string, unknown> = {
      q: "*",
      query_by: this.options.defaultSearchField as string,
      per_page: 0,
      filter_by: filterBy,
    };

    const { data } = await this.axios<{ found: number }>({
      method: "GET",
      url: `/collections/${this.options.name}/documents/search`,
      params,
    });

    return data.found;
  }

  async upsert(docs: T["infer"] | T["infer"][]): Promise<UpsertResult[]> {
    await this.ensureSynced();

    const items = Array.isArray(docs) ? docs : [docs];

    if (!items.length) return [];

    if (this.options.validateOnUpsert) {
      for (const item of items) {
        this.options.schema.assert(item);
      }
    }

    const payload = items
      .map((item) => JSON.stringify(this.serializeDoc(item)))
      .join("\n");

    const params: Record<string, unknown> = { action: "upsert" };

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

    if (typeof data === "string") {
      return data.split("\n").map((v: string) => JSON.parse(v));
    }

    return [data as UpsertResult];
  }

  async syncData(options?: SyncOptions): Promise<SyncResult> {
    if (!this.dataSyncConfig) {
      throw new Error("DATA_SYNC_NOT_CONFIGURED");
    }

    const chunkSize =
      options?.chunkSize ?? this.dataSyncConfig.chunkSize ?? 500;
    const ids = options?.ids ?? (await this.dataSyncConfig.getAllIds());

    let upserted = 0;
    let failed = 0;

    for (const chunk of chunkArray(ids, chunkSize)) {
      const items = await this.dataSyncConfig.getItems(chunk);
      const results = await this.upsert(items);

      for (const r of results) {
        if (r.success) upserted++;
        else failed++;
      }
    }

    let deleted = 0;
    if (options?.purge) {
      deleted = await this.purgeOrphans(ids, chunkSize);
    }

    return { upserted, deleted, failed };
  }

  private async purgeOrphans(
    validIds: string[],
    chunkSize: number,
  ): Promise<number> {
    const validSet = new Set(validIds);
    const remoteIds = await this.exportIds();
    const orphans = remoteIds.filter((id) => !validSet.has(id));

    if (!orphans.length) return 0;

    let deleted = 0;
    for (const chunk of chunkArray(orphans, chunkSize)) {
      const result = await this.deleteMany({ id: chunk } as FilterFor<
        T["infer"]
      >);
      deleted += result.deleted;
    }

    return deleted;
  }

  async exportIds(): Promise<string[]> {
    const { data } = await this.axios<string>({
      method: "GET",
      url: `/collections/${this.options.name}/documents/export`,
      params: { include_fields: "id" },
    });

    return data
      .split("\n")
      .filter((line) => line.length)
      .map((line) => JSON.parse(line).id);
  }

  scoped(baseFilter: FilterFor<T["infer"]>): ScopedCollection<T["infer"]> {
    return {
      search: <
        const O extends SearchOptions<T["infer"]> = SearchOptionsPlain<
          T["infer"]
        >,
      >(
        options: O,
      ) =>
        this.search({
          ...options,
          filter: { ...options.filter, ...baseFilter },
        }),

      searchList: (options: SearchListOptions<T["infer"]>) =>
        this.searchList({
          ...options,
          filter: { ...options.filter, ...baseFilter },
        }),

      count: (filter?: FilterFor<T["infer"]>) =>
        this.count({ ...filter, ...baseFilter }),

      deleteMany: (filter: FilterFor<T["infer"]>) =>
        this.deleteMany({ ...filter, ...baseFilter }),

      updateMany: (filter: FilterFor<T["infer"]>, data: Partial<T["infer"]>) =>
        this.updateMany({ ...filter, ...baseFilter }, data),
    };
  }
}
