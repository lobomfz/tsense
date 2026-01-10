import type { Type } from "arktype";

type BaseIfArray<T> = T extends (infer Q)[] ? Q : T;

export type FieldSchema = {
	name: string;
	type: string;
	facet?: boolean;
	sort?: boolean;
	index?: boolean;
	optional?: boolean;
};

export type SearchHit<T> = {
	document: T;
	highlight?: Record<string, { snippet?: string }>;
	text_match?: number;
};

export type SearchApiResponse<T> = {
	found: number;
	hits?: SearchHit<T>[];
	facet_counts?: {
		field_name: string;
		counts: { value: string; count: number }[];
	}[];
};

export type ConnectionConfig = {
	host: string;
	port: number;
	protocol: "http" | "https";
	apiKey: string;
	timeout?: number;
};

export type TsenseOptions<T extends Type> = {
	name: string;
	schema: T;
	connection: ConnectionConfig;
	defaultSearchField?: keyof T["infer"];
	defaultSortingField?: keyof T["infer"];
	batchSize?: number;
	validateOnUpsert?: boolean;
};

type SingleFilter<T> = Partial<{
	[K in keyof T]:
		| BaseIfArray<T[K]>
		| NonNullable<BaseIfArray<T[K]>>[]
		| { not?: BaseIfArray<T[K]> }
		| (NonNullable<T[K]> extends number
				? { min?: number; max?: number }
				: never);
}>;

export type FilterFor<T> = SingleFilter<T> & {
	OR?: FilterFor<T>[];
};

export type HighlightOptions<T> = {
	fields?: (keyof T)[];
	startTag?: string;
	endTag?: string;
};

type SortableField<T> = Extract<keyof T, string> | "score";

type BaseSearchOptions<T> = {
	query?: string;
	queryBy?: (keyof T)[];
	filter?: FilterFor<T>;
	sortBy?: `${SortableField<T>}:${"asc" | "desc"}`[];
	facetBy?: (keyof T)[];
	page?: number;
	limit?: number;
	highlight?: boolean | HighlightOptions<T>;
};

export type SearchOptions<T> = BaseSearchOptions<T> &
	(
		| { pick?: (keyof T)[]; omit?: never }
		| { omit?: (keyof T)[]; pick?: never }
		| { pick?: never; omit?: never }
	);

export type SearchResult<T> = {
	count: number;
	data: T[];
	facets: Record<string, Record<string, number>>;
	scores: number[];
};

export type DeleteResult = {
	deleted: number;
};

export type UpdateResult = {
	updated: number;
};

export type UpsertResult = {
	success: boolean;
	error?: string;
	document?: unknown;
};
