export type UndefinedToOptional<T> = {
	[K in keyof T as undefined extends T[K] ? K : never]?: Exclude<
		T[K],
		undefined
	>;
} & {
	[K in keyof T as undefined extends T[K] ? never : K]: T[K];
};

export type BaseIfArray<T> = T extends (infer Q)[] ? Q : T;

// from kysely
type DrainOuterGeneric<T> = [T] extends [unknown] ? T : never;
export type Simplify<T> = DrainOuterGeneric<
	{
		[K in keyof T]: T[K];
	} & {}
>;
