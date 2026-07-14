export const DateTransformer = {
    match: (expr, domain) => expr === "Date" || domain === "Date",
    storageType: "int64",
    serialize: (date) => {
        if (typeof date === "number") {
            return date;
        }
        if (typeof date === "string") {
            return new Date(date).getTime();
        }
        return date.getTime();
    },
    deserialize: (ts) => new Date(ts),
};
