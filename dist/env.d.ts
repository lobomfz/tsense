export type TsenseFieldType = "string" | "int32" | "int64" | "float" | "bool" | "image" | "string[]" | "int32[]" | "int64[]" | "float[]" | "bool[]" | "geopoint" | "geopoint[]" | "object" | "object[]" | "auto" | "string*";
export type TsenseFieldMeta = {
    type?: TsenseFieldType;
    facet?: boolean;
    sort?: boolean;
    index?: boolean;
};
declare global {
    interface ArkEnv {
        meta(): TsenseFieldMeta;
    }
}
