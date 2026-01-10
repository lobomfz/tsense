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
	HighlightOptions,
	SearchApiResponse,
	SearchListOptions,
	SearchListResult,
	SearchOptions,
	SearchResult,
	TsenseOptions,
	UpdateResult,
	UpsertResult,
} from "./types.js";

const redaxiosInstance = redaxios.default ?? redaxios;

const arkToTsense: Record<string, TsenseFieldMeta["type"]> = {
	string: "string",
	number: "float",
	"number.integer": "int64",
	boolean: "bool",
	"string[]": "string[]",
	"number[]": "float[]",
	"boolean[]": "bool[]",
};

export type AxiosInstance = ReturnType<typeof redaxiosInstance.create>;

export class TSense<T extends Type> {
	private fields: FieldSchema[] = [];
	private axios: AxiosInstance;
	private synced = false;
	private fieldTransformers = new Map<string, FieldTransformer>();

	infer: T["infer"] = undefined;

	constructor(private options: TsenseOptions<T>) {
		this.axios = redaxiosInstance.create({
			baseURL: `${options.connection.protocol}://${options.connection.host}:${options.connection.port}`,
			headers: { "X-TYPESENSE-API-KEY": options.connection.apiKey },
		});

		this.extractFields(options.transformers ?? defaultTransformers);
	}

	private inferType(arkType: string): TsenseFieldType {
		const direct = arkToTsense[arkType];

		if (direct) return direct;

		if (arkType.includes("[]")) return "object[]";
		if (arkType.includes("{") || arkType.includes("|")) return "object";
		if (arkType.startsWith("'") || arkType.includes("'")) return "string";

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

		if (typeof value === "object" && value !== null) {
			const v = value as Record<string, unknown>;
			const isFilterObject = "min" in v || "max" in v || "not" in v;

			if (!isFilterObject) {
				return transformer.serialize(value);
			}

			const result = { ...v };

			if ("min" in v && v.min != null)
				result.min = transformer.serialize(v.min);
			if ("max" in v && v.max != null)
				result.max = transformer.serialize(v.max);
			if ("not" in v && v.not != null)
				result.not = transformer.serialize(v.not);

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
					};
				}[];
			};
		};

		for (const prop of internal.structure.props) {
			const meta = prop.value.meta as TsenseFieldMeta | undefined;
			const expression = String(prop.value.expression);
			const domain = prop.value.domain;

			const transformer = transformers.find((t) => t.match(expression, domain));

			if (transformer) {
				this.fieldTransformers.set(prop.key, transformer);
				this.fields.push({
					name: prop.key,
					type: transformer.storageType,
					optional: prop.kind === "optional",
					facet: meta?.facet,
					sort: meta?.sort,
					index: meta?.index,
				});
				continue;
			}

			const type = meta?.type ?? this.inferType(domain ?? expression);

			this.fields.push({
				name: prop.key,
				type,
				optional: prop.kind === "optional",
				facet: meta?.facet,
				sort: meta?.sort,
				index: meta?.index,
			});
		}
	}

	private async ensureSynced(force?: boolean): Promise<void> {
		if (!force && (this.synced || !this.options.autoSync)) return;

		await new TSenseMigrator(
			this.options.name,
			this.fields,
			this.options.defaultSortingField as string | undefined,
			this.axios,
		).sync();

		this.synced = true;
	}

	async sync(): Promise<void> {
		await this.ensureSynced(true);
	}

	private buildObjectFilter(key: string, value: unknown) {
		if (Array.isArray(value)) {
			return `(${key}:[${value.join(",")}])`;
		}

		const v = value as { not?: unknown; min?: number; max?: number };

		if ("not" in v) {
			return `${key}:!=${v.not}`;
		}

		const min = v.min ?? undefined;
		const max = v.max ?? undefined;

		if (min != null && max != null) {
			return `${key}:[${min}..${max}]`;
		}

		if (max != null) {
			return `${key}:<=${max}`;
		}

		if (min != null) {
			return `${key}:>=${min}`;
		}
	}

	private buildFilter(filter: FilterFor<T["infer"]> | undefined): string[] {
		const result: string[] = [];

		for (const entry of Object.entries(filter ?? {})) {
			const [key, rawValue] = entry as [string, unknown];

			if (rawValue == null) continue;

			if (key === "OR") {
				const orFilter: string[] = [];

				for (const condition of rawValue as FilterFor<T["infer"]>[]) {
					const inner = this.buildFilter(condition);
					orFilter.push(`(${inner.join("||")})`);
				}

				result.push(`(${orFilter.join("||")})`);
				continue;
			}

			const value = this.serializeFilterValue(key, rawValue);

			switch (typeof value) {
				case "string":
				case "number":
				case "boolean":
					result.push(`${key}:=${value}`);
					break;
				case "object": {
					const built = this.buildObjectFilter(key, value);
					if (built) result.push(built);
					break;
				}
				default:
					break;
			}
		}

		return result;
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

	async search(
		options: SearchOptions<T["infer"]>,
	): Promise<SearchResult<T["infer"]>> {
		await this.ensureSynced();

		const params: Record<string, unknown> = {
			q: options.query ?? "",
			query_by: (
				(options.queryBy as string[]) ?? [
					this.options.defaultSearchField as string,
				]
			).join(","),
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
			params.include_fields = (options.pick as string[]).join(",");
		}

		if ("omit" in options && options.omit) {
			params.exclude_fields = (options.omit as string[]).join(",");
		}

		const highlight = options.highlight;

		const highlightEnabled = !!highlight;

		let highlightOpts: HighlightOptions<T["infer"]> | undefined;

		if (typeof highlight === "object") {
			highlightOpts = highlight;

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
			if (highlightEnabled) {
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
		};
	}

	async searchList(
		options: SearchListOptions<T["infer"]>,
	): Promise<SearchListResult<T["infer"]>> {
		await this.ensureSynced();

		const limit = Math.min(options.limit ?? 20, 100);
		const field = options.sort.field as string;

		const params: Record<string, unknown> = {
			q: options.query ?? "",
			query_by: (
				(options.queryBy as string[]) ?? [
					this.options.defaultSearchField as string,
				]
			).join(","),
			per_page: limit,
			sort_by: `${field}:${options.sort.direction}`,
		};

		const filterParts = this.buildFilter(options.filter);

		if (options.cursor) {
			const op = options.sort.direction === "asc" ? ">" : "<";
			filterParts.push(`${field}:${op}${options.cursor}`);
		}

		const filterBy = filterParts.join("&&");
		if (filterBy) params.filter_by = filterBy;

		const { data: res } = await this.axios<SearchApiResponse<T["infer"]>>({
			method: "GET",
			url: `/collections/${this.options.name}/documents/search`,
			params,
		});

		const hits = res.hits ?? [];
		const data: T["infer"][] = [];

		const lastHit = hits[hits.length - 1]!.document as Record<string, unknown>;
		const nextCursor = String(lastHit[field]);

		for (const hit of hits) {
			const doc = this.deserializeDoc(hit.document as Record<string, unknown>);

			data.push(doc);
		}

		if (data.length < limit) {
			return { data, nextCursor: null };
		}

		return { data, nextCursor };
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
}
