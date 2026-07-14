import type { TsenseFieldType } from "../env.js";
export interface FieldTransformer<TJs = unknown, TStorage = unknown> {
    match: (expression: string, domain?: string) => boolean;
    storageType: TsenseFieldType;
    serialize: (value: TJs) => TStorage;
    deserialize: (value: TStorage) => TJs;
}
