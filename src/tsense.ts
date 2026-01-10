import type { Type } from "arktype";
import redaxios from "redaxios";

const axios = redaxios.default ?? redaxios;

import type { TsenseFieldMeta, TsenseFieldType } from "./env.js";
import type {
	DeleteResult,
	FieldSchema,
	FilterFor,
	HighlightOptions,
	SearchApiResponse,
	SearchOptions,
	SearchResult,
	TsenseOptions,
	UpdateResult,
	UpsertResult,
} from "./types.js";

const requiresNested = ["object", "object[]"];

const arkToTsense: Record<string, TsenseFieldMeta["type"]> = {
	string: "string",
	number: "float",
	"number.integer": "int64",
	boolean: "bool",
	"string[]": "string[]",
	"number[]": "float[]",
	"boolean[]": "bool[]",
};

export class TSense<T extends Type> {
	private fields: FieldSchema[] = [];
	private enableNested = false;
	private baseURL: string;
	private headers: Record<string, string>;
	infer: T["infer"] = undefined;

	constructor(private options: TsenseOptions<T>) {
		const { connection } = options;
		this.baseURL = `${connection.protocol}://${connection.host}:${connection.port}`;
		this.headers = { "X-TYPESENSE-API-KEY": connection.apiKey };
		this.extractFields();
	}

	private inferType(arkType: string): TsenseFieldType {
		const direct = arkToTsense[arkType];

		if (direct) return direct;

		if (arkType.includes("[]")) return "object[]";
		if (arkType.includes("{") || arkType.includes("|")) return "object";
		if (arkType.startsWith("'") || arkType.includes("'")) return "string";

		return "string";
	}

	private extractFields() {
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

			const tsType = meta?.type ?? this.inferType(domain ?? expression);

			if (requiresNested.includes(tsType)) {
				this.enableNested = true;
			}

			this.fields.push({
				name: prop.key,
				type: tsType,
				optional: prop.kind === "optional",
				facet: meta?.facet,
				sort: meta?.sort,
				index: meta?.index,
			});
		}
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
			const [key, value] = entry as [string, unknown];

			if (value == null) continue;

			if (key === "OR") {
				const orFilter: string[] = [];

				for (const condition of value as FilterFor<T["infer"]>[]) {
					const inner = this.buildFilter(condition);
					orFilter.push(`(${inner.join("||")})`);
				}

				result.push(`(${orFilter.join("||")})`);
				continue;
			}

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
		await axios({
			method: "POST",
			baseURL: this.baseURL,
			url: "/collections",
			headers: this.headers,
			data: {
				name: this.options.name,
				fields: this.fields,
				default_sorting_field: this.options.defaultSortingField,
				enable_nested_fields: this.enableNested,
			},
		});

		return this;
	}

	async drop(): Promise<void> {
		await axios({
			method: "DELETE",
			baseURL: this.baseURL,
			url: `/collections/${this.options.name}`,
			headers: this.headers,
		});
	}

	async get(id: string): Promise<T["infer"] | null> {
		const { data } = await axios<T["infer"]>({
			method: "GET",
			baseURL: this.baseURL,
			url: `/collections/${this.options.name}/documents/${id}`,
			headers: this.headers,
		}).catch((e: { status?: number }) => {
			if (e.status === 404) return { data: null };
			throw e;
		});

		return data;
	}

	async delete(id: string): Promise<boolean> {
		const { data } = await axios<T["infer"]>({
			method: "DELETE",
			baseURL: this.baseURL,
			url: `/collections/${this.options.name}/documents/${id}`,
			headers: this.headers,
		}).catch((e: { status?: number }) => {
			if (e.status === 404) return { data: null };
			throw e;
		});

		return data != null;
	}

	async deleteMany(filter: FilterFor<T["infer"]>): Promise<DeleteResult> {
		const filterBy = this.buildFilter(filter).join("&&");

		if (!filterBy) {
			throw new Error("FILTER_REQUIRED");
		}

		const { data } = await axios<{ num_deleted: number }>({
			method: "DELETE",
			baseURL: this.baseURL,
			url: `/collections/${this.options.name}/documents`,
			headers: this.headers,
			params: { filter_by: filterBy },
		});

		return { deleted: data.num_deleted };
	}

	async update(id: string, data: Partial<T["infer"]>): Promise<T["infer"]> {
		const { data: updated } = await axios<T["infer"]>({
			method: "PATCH",
			baseURL: this.baseURL,
			url: `/collections/${this.options.name}/documents/${id}`,
			headers: this.headers,
			data,
		});

		return updated;
	}

	async updateMany(
		filter: FilterFor<T["infer"]>,
		data: Partial<T["infer"]>,
	): Promise<UpdateResult> {
		const filterBy = this.buildFilter(filter).join("&&");

		if (!filterBy) {
			throw new Error("FILTER_REQUIRED");
		}

		const { data: result } = await axios<{ num_updated: number }>({
			method: "PATCH",
			baseURL: this.baseURL,
			url: `/collections/${this.options.name}/documents`,
			headers: this.headers,
			params: { filter_by: filterBy },
			data,
		});

		return { updated: result.num_updated };
	}

	async search(
		options: SearchOptions<T["infer"]>,
	): Promise<SearchResult<T["infer"]>> {
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

		const { data: res } = await axios<SearchApiResponse<T["infer"]>>({
			method: "GET",
			baseURL: this.baseURL,
			url: `/collections/${this.options.name}/documents/search`,
			headers: this.headers,
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

			data.push(hit.document as T["infer"]);
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

	async upsert(docs: T["infer"] | T["infer"][]): Promise<UpsertResult[]> {
		const items = Array.isArray(docs) ? docs : [docs];

		if (!items.length) return [];

		if (this.options.validateOnUpsert) {
			for (const item of items) {
				this.options.schema.assert(item);
			}
		}

		const payload = items.map((item) => JSON.stringify(item)).join("\n");

		const params: Record<string, unknown> = { action: "upsert" };

		if (this.options.batchSize) {
			params.batch_size = this.options.batchSize;
		}

		const { data } = await axios({
			method: "POST",
			baseURL: this.baseURL,
			url: `/collections/${this.options.name}/documents/import`,
			headers: { ...this.headers, "Content-Type": "text/plain" },
			params,
			data: payload,
		});

		if (typeof data === "string") {
			return data.split("\n").map((v: string) => JSON.parse(v));
		}

		return [data as UpsertResult];
	}
}
