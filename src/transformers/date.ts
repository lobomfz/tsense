import type { FieldTransformer } from "./types.js";

export const DateTransformer: FieldTransformer<Date, number> = {
	match: (expr, domain) => expr === "Date" || domain === "Date",
	storageType: "int64",
	serialize: (date) => date.getTime(),
	deserialize: (ts) => new Date(ts),
};
