import type { Client } from "typesense";
import type { CollectionFieldSchema } from "typesense/lib/Typesense/Collection.js";
import type {
	CustomCollectionField,
	SearchFilters,
	InferCollectionTypes,
	InferFacetResponse,
} from "./types/core.js";
import type { Simplify } from "./types/helpers.js";

const requiresNested = ["object", "object[]"];

export class TSense<
	Options extends CustomCollectionField,
	Fields extends Record<string, Options>,
	Inferred = InferCollectionTypes<Fields>,
> {
	infer: Inferred = undefined as any;

	constructor(
		private name: string,
		private data: {
			fields: Fields;
			client: Client;
			default_search_field?: NoInfer<keyof Inferred>;
			default_sorting_field?: NoInfer<keyof Inferred>;
			batch_size?: number;
			enable_nested_fields?: boolean;
		},
	) {}

	private checkNested(fields: CollectionFieldSchema[]) {
		if (this.data.enable_nested_fields) {
			return;
		}

		for (const field of fields) {
			requiresNested.includes(field.type);

			this.data.enable_nested_fields = true;

			return;
		}
	}

	private buildObjectFilter(key: string, value: any) {
		if (Array.isArray(value)) {
			return `(${key}:[${value.join(",")}])`;
		}

		if ("not" in value) {
			return `${key}:!=${value.not}`;
		}

		const min = value.min != null ? value.min : undefined;

		const max = value.max != null ? value.max : undefined;

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

	private buildSort(data: SearchFilters<Inferred>) {
		if (!data.order_by) {
			return;
		}

		const order: string[] = [];

		for (const key of this.maybeArray(data.order_by)) {
			const splitted = (key as any).split(" ");

			let direction = splitted.at(-1);

			if (direction !== "asc" && direction !== "desc") {
				direction = data.direction ?? "desc";
			}

			// safeguard
			if (splitted[0] === "undefined") {
				continue;
			}

			if (splitted[0] === "score") {
				splitted[0] = "_text_match";
			}

			order.push(`${splitted[0]}:${direction}`);
		}

		return order.join(",");
	}

	private buildFilter(data: SearchFilters<Inferred>): string[] {
		const filter: string[] = [];

		for (const entry of Object.entries(data.filter ?? {})) {
			const [key, value] = entry as [string, any];

			if (value == null) continue;

			if (key === "OR") {
				const orFilter: string[] = [];

				for (const condition of value) {
					const filter = this.buildFilter({ filter: condition });

					orFilter.push(`(${filter.join("||")})`);
				}

				filter.push(`(${orFilter.join("||")})`);

				continue;
			}

			switch (typeof value) {
				case "string":
				case "number":
				case "boolean":
					filter.push(`${key}:=${value}`);
					break;
				case "object": {
					const built = this.buildObjectFilter(key, value);

					if (built) {
						filter.push(built);
					}
					break;
				}
				default: {
					break;
				}
			}
		}

		return filter;
	}

	private maybeArray<T>(d: T): T extends any[] ? T : T[] {
		if (Array.isArray(d)) {
			return d as any;
		}

		return [d] as any;
	}

	async delete() {
		await this.data.client.collections(this.name).delete();
	}

	async create() {
		const fields: CollectionFieldSchema[] = [];

		for (const [name, field] of Object.entries(this.data.fields)) {
			const isSimpleField = typeof field === "string";

			if (isSimpleField) {
				const isOptional = field[field.length - 1] === "?";

				const realType: any = isOptional ? field.slice(0, -1) : field;

				fields.push({
					name,
					type: realType as any,
					optional: isOptional,
				});

				continue;
			}

			fields.push({
				name,
				type: field.type,
				optional: field.optional,
				facet: field.facet,
				index: field.index,
				sort: field.sort,
			});
		}

		this.checkNested(fields);

		await this.data.client.collections().create({
			name: this.name,
			fields,
			default_sorting_field: this.data.default_sorting_field as string,
			enable_nested_fields: this.data.enable_nested_fields,
		});

		return this;
	}

	async searchDocuments<Filter extends SearchFilters<Inferred>>(
		data: Filter,
	): Promise<{
		count: number;
		data: Inferred[];
		facet: Simplify<InferFacetResponse<Inferred, Filter>>;
	}> {
		const res = await this.data.client
			.collections(this.name)
			.documents()
			.search({
				q: data.search ?? "",
				query_by: (data.search_keys as any) ?? [this.data.default_search_field],
				sort_by: this.buildSort(data),
				filter_by: this.buildFilter(data).join("&&"),
				page: data.page,
				limit: data.limit,
				facet_by: data?.facet_by as any,
			});

		const facet_result: any = data?.facet_by
			? data.enable_facet_total
				? { total: 0 }
				: {}
			: undefined;

		if (res.facet_counts?.[0]?.counts) {
			for (const iter of res.facet_counts[0].counts) {
				facet_result[iter.value] = iter.count;

				if (data?.enable_facet_total) {
					facet_result.total += iter.count;
				}
			}
		}

		const result = [];

		for (const hit of res.hits ?? []) {
			if (data.highlight) {
				for (const [key, value] of Object.entries(hit.highlight)) {
					if (value) {
						// @ts-expect-error
						hit.document[key] = value.snippet;
					}
				}
			}

			result.push(hit.document);
		}

		return {
			data: result as any,
			count: res.found,
			facet: facet_result,
		};
	}

	async upsertDocuments(items: Inferred | Inferred[]) {
		const parsed = [];

		for (const item of this.maybeArray(items)) {
			parsed.push(JSON.stringify(item));
		}

		if (!parsed.length) {
			return;
		}

		const res = await this.data.client
			.collections(this.name)
			.documents()
			.import(parsed.join("\n"), {
				action: "upsert",
				batch_size: this.data.batch_size,
			});

		return res.split("\n").map((v) => JSON.parse(v));
	}
}
