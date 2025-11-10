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

export type InferCollectionTypes<Fields> = Simplify<
	{
		id?: string;
	} & UndefinedToOptional<{
		[K in keyof Fields]: Fields[K] extends ValidFieldType
			? TypesenseToTS[Fields[K]]
			: Fields[K] extends { override: infer Override }
				? Fields[K] extends { optional: true }
					? Override | null | undefined
					: Override
				: Fields[K] extends { type: infer T }
					? T extends ValidFieldType
						? Fields[K] extends { optional: true }
							? TypesenseToTS[T] | null | undefined
							: TypesenseToTS[T]
						: never
					: Fields[K] extends `${infer RealType}?`
						? RealType extends ValidFieldType
							? TypesenseToTS[RealType] | null | undefined
							: never
						: never;
	}>
>;

type OrderBy<Inferred, Options = keyof Inferred | "score"> =
	| Options
	| Options[]
	| (Options extends infer Q
			? Q extends string
				? `${Q} ${"asc" | "desc"}`
				: never
			: never)[];

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

export type Filters<Inferred> = {
	search?: string;
	filter?: RecursiveFilter<Inferred>;
	order_by?: OrderBy<Inferred> | undefined;
	direction?: "asc" | "desc";
	page?: number;
	limit?: number;
	search_keys?: (keyof Inferred)[];
	highlight?: boolean;
};
