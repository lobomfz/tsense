import type { AxiosInstance } from "./tsense.js";
import type { FieldSchema, SchemaInspection } from "./types.js";
export declare class TSenseMigrator {
    private collectionName;
    private localFields;
    private defaultSortingField;
    private axios;
    constructor(collectionName: string, localFields: readonly FieldSchema[], defaultSortingField: string | undefined, axios: AxiosInstance);
    sync(): Promise<void>;
    inspect(): Promise<SchemaInspection>;
    private exists;
    private getRemote;
    private diff;
    private fieldsMatch;
    private fieldValue;
    private patch;
    private create;
}
