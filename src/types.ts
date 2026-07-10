import type { FieldTransformer } from "./transformers/types.js";

type BaseIfArray<T> = T extends (infer Q)[] ? Q : T;

export type WithNull<T> = {
  [K in keyof T]: undefined extends T[K] ? T[K] | null : T[K];
};

export type FieldSchema = {
  name: string;
  type: string;
  sourceExpression?: string;
  facet?: boolean;
  sort?: boolean;
  index?: boolean;
  optional?: boolean;
  enumValues?: string[];
};

type SearchHit<T> = {
  document: T;
  highlight?: Record<string, { snippet?: string }>;
  text_match?: number;
};

export type SearchApiResponse<T> = {
  found: number;
  hits?: SearchHit<T>[];
  grouped_hits?: {
    group_key: unknown[];
    found?: number;
    hits: SearchHit<T>[];
  }[];
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

export interface TsenseSchema<Inferred = unknown> {
  readonly infer: Inferred;
  assert(data: unknown): Inferred;
}

export type TsenseOptions<T extends TsenseSchema> = {
  name: string;
  schema: T;
  connection: ConnectionConfig;
  defaultSearchField?: keyof T["infer"];
  defaultSortingField?: keyof T["infer"];
  batchSize?: number;
  validateOnUpsert?: boolean;
  autoSyncSchema?: boolean;
  timezone?: string;
  transformers?: FieldTransformer[];
  dataSync?: SyncConfig<T["infer"]>;
};

export type RelativeDateUnit = "day" | "week" | "month";

export type RelativeDate =
  | { startOf: RelativeDateUnit }
  | { endOf: RelativeDateUnit };

type DateValue = Date | RelativeDate;

export type StringFilter = {
  not?: string | null;
  notIn?: string[];
};

export type NumberFilter = {
  not?: number;
  notIn?: number[];
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
};

export type BooleanFilter = {
  not?: boolean;
};

type DateFilter = {
  not?: DateValue;
  notIn?: DateValue[];
  gt?: DateValue;
  gte?: DateValue;
  lt?: DateValue;
  lte?: DateValue;
};

type FilterValueFor<T> = [T] extends [boolean]
  ? boolean | BooleanFilter
  : [T] extends [Date]
    ? DateValue | DateValue[] | DateFilter
    : [T] extends [number]
      ? number | number[] | NumberFilter
      : [T] extends [string]
        ? T | T[] | StringFilter
        : never;

type SingleFilter<T> = Partial<{
  [K in keyof T]: FilterValueFor<NonNullable<BaseIfArray<T[K]>>>;
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

export type SortFor<T> = `${SortableField<T>}:${"asc" | "desc"}`;

type BaseSearchOptions<T> = {
  query?: string;
  queryBy?: (keyof T)[];
  filter?: FilterFor<T>;
  sortBy?: SortFor<T>[];
  facetBy?: (keyof T)[];
  page?: number;
  limit?: number;
  highlight?: boolean | HighlightOptions<T>;
  rawFilter?: string[];
  exhaustiveSearch?: boolean;
};

export type GroupSearchOptions<T> = BaseSearchOptions<T> & {
  groupBy: Extract<keyof T, string> | Extract<keyof T, string>[];
  groupLimit: number;
};

export type GroupSearchResult<T> = {
  groups: {
    keys: string[];
    count: number;
    data: T[];
  }[];
  count: number;
};

export type SearchOptionsWithPick<
  T,
  K extends readonly (keyof T)[],
> = BaseSearchOptions<T> & {
  pick: K;
  omit?: never;
};

export type SearchOptionsWithOmit<
  T,
  K extends readonly (keyof T)[],
> = BaseSearchOptions<T> & {
  omit: K;
  pick?: never;
};

export type SearchOptionsPlain<T> = BaseSearchOptions<T> & {
  pick?: never;
  omit?: never;
};

export type SearchOptions<T> =
  | SearchOptionsWithPick<T, readonly (keyof T)[]>
  | SearchOptionsWithOmit<T, readonly (keyof T)[]>
  | SearchOptionsPlain<T>;

export type ProjectSearch<T, O> = O extends { pick: readonly (infer K)[] }
  ? Pick<T, Extract<K, keyof T>>
  : O extends { omit: readonly (infer K)[] }
    ? Omit<T, Extract<K, keyof T>>
    : T;

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

export type CollectionInfo = {
  name: string;
  num_documents: number;
  fields: FieldSchema[];
  default_sorting_field?: string;
  enable_nested_fields?: boolean;
};

export type SchemaInspection =
  | { status: "missing" }
  | { status: "in_sync" }
  | {
      status: "drift";
      add: FieldSchema[];
      remove: FieldSchema[];
      modify: FieldSchema[];
      defaultSortingFieldChanged: boolean;
    };

export type Synonym = {
  root?: string;
  synonyms: string[];
};

export type SearchInput<T> = {
  query?: string;
  filter?: FilterFor<T>;
  page?: number;
  limit?: number;
};

export type SearchListOptions<T> = {
  query?: string;
  queryBy?: (keyof T)[];
  filter?: FilterFor<T>;
  sortBy: `${Extract<keyof T, string>}:${"asc" | "desc"}`;
  limit?: number;
  cursor?: string;
};

export type SearchListResult<T> = {
  data: T[];
  nextCursor: string | null;
  total: number;
};

export type ScopedCollection<T> = {
  search: <const O extends SearchOptions<T> = SearchOptionsPlain<T>>(
    options: O,
  ) => Promise<SearchResult<ProjectSearch<T, O>>>;
  searchList: (options: SearchListOptions<T>) => Promise<SearchListResult<T>>;
  count: (filter?: FilterFor<T>) => Promise<number>;
  deleteMany: (filter: FilterFor<T>) => Promise<DeleteResult>;
  updateMany: (filter: FilterFor<T>, data: Partial<T>) => Promise<UpdateResult>;
};

export type SyncConfig<T> = {
  getAllIds: () => Promise<string[]>;
  getItems: (ids: string[]) => Promise<(WithNull<T> & { id: string })[]>;
  chunkSize?: number;
};

export type SyncOptions = {
  ids?: string[];
  purge?: boolean;
  chunkSize?: number;
};

export type SyncResult = {
  upserted: number;
  deleted: number;
  failed: number;
};
