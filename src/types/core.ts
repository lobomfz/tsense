import type { FieldType } from "typesense/lib/Typesense/Collection.js";
import type { BaseIfArray, Simplify, UndefinedToOptional } from "./helpers.js";

export type CustomCollectionField =
	| FieldType
	| `${FieldType}?`
	| {
			type: FieldType;
			optional?: boolean;
			facet?: boolean;
			index?: boolean;
			override?: any;
			sort?: boolean;
	  };

type TypesenseToTS = {
	string: string;
	int32: number;
	int64: number;
	float: number;
	bool: boolean;
	image: string;

	"string[]": string[];
	"int32[]": number[];
	"int64[]": number[];
	"float[]": number[];
	"bool[]": boolean[];

	geopoint: unknown;
	"geopoint[]": unknown[];
	object: unknown;
	"object[]": unknown[];
	auto: unknown;
	"string*": unknown;
};

type ValidFieldType = keyof TypesenseToTS;
type MaybeOptional<Field, Result> = Field extends { optional: true }
	? Result | null | undefined
	: Result;

export type InferCollectionTypes<Fields> = Simplify<
	{
		id?: string;
	} & UndefinedToOptional<{
		[K in keyof Fields]: MaybeOptional<
			Fields[K],
			Fields[K] extends { override: infer Override }
				? Override
				: Fields[K] extends ValidFieldType
					? TypesenseToTS[Fields[K]]
					: Fields[K] extends { type: infer T }
						? T extends ValidFieldType
							? TypesenseToTS[T]
							: never
						: Fields[K] extends `${infer RealType}?`
							? RealType extends ValidFieldType
								? TypesenseToTS[RealType] | null | undefined
								: never
							: never
		>;
	}>
>;

type OrderBy<Inferred, Options = keyof Inferred | "score"> =
	| Options
	| Options[]
	| (Options extends string ? `${Options} ${"asc" | "desc"}` : never)[];

type SingleFilter<Inferred> = Partial<{
	[K in keyof Inferred]:
		| BaseIfArray<Inferred[K]>
		| NonNullable<BaseIfArray<Inferred[K]>>[]
		| {
				not?: string | string[] | boolean | null;
		  }
		| (NonNullable<Inferred[K]> extends number
				? {
						min?: number;
						max?: number;
					}
				: never);
}>;

type RecursiveFilter<Inferred> = SingleFilter<Inferred> & {
	OR?: RecursiveFilter<Inferred>[];
};

export type SearchFilters<Inferred> = {
	search?: string;
	filter?: RecursiveFilter<Inferred>;
	order_by?: OrderBy<Inferred> | undefined;
	direction?: "asc" | "desc";
	page?: number;
	limit?: number;
	search_keys?: (keyof Inferred)[];
	highlight?: boolean;
	facet_by?: NoInfer<keyof Inferred>;
	enable_facet_total?: boolean;
};

export type InferFacetResponse<Inferred, Filter> = Filter extends {
	facet_by: infer FacetBy;
}
	? FacetBy extends keyof Inferred
		? Record<
				NonNullable<Inferred[FacetBy]> extends string
					? NonNullable<Inferred[FacetBy]>
					: never,
				number
			> &
				(Filter extends {
					enable_facet_total: true;
				}
					? { total: number }
					: {})
		: never
	: never;
