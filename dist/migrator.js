const COMPARABLE_KEYS = ["type", "facet", "sort", "index", "optional"];
const NESTED_TYPES = new Set(["object", "object[]"]);
const DEFAULT_SORT_TYPES = new Set([
    "int32",
    "int32[]",
    "int64",
    "int64[]",
    "float",
    "float[]",
    "bool",
    "bool[]",
]);
export class TSenseMigrator {
    collectionName;
    localFields;
    defaultSortingField;
    axios;
    constructor(collectionName, localFields, defaultSortingField, axios) {
        this.collectionName = collectionName;
        this.localFields = localFields;
        this.defaultSortingField = defaultSortingField;
        this.axios = axios;
    }
    async sync() {
        const inspection = await this.inspect();
        if (inspection.status === "missing") {
            return await this.create();
        }
        if (inspection.status === "in_sync") {
            return;
        }
        if (inspection.defaultSortingFieldChanged) {
            throw new Error("SCHEMA_RECREATE_REQUIRED");
        }
        await this.patch({
            toAdd: inspection.add,
            toRemove: inspection.remove,
            toModify: inspection.modify,
        });
    }
    async inspect() {
        const exists = await this.exists();
        if (!exists) {
            return { status: "missing" };
        }
        const remote = await this.getRemote();
        const diff = this.diff(remote.fields);
        const defaultSortingFieldChanged = (remote.default_sorting_field || undefined) !==
            (this.defaultSortingField ?? undefined);
        if (!defaultSortingFieldChanged &&
            !diff.toAdd.length &&
            !diff.toRemove.length &&
            !diff.toModify.length) {
            return { status: "in_sync" };
        }
        return {
            status: "drift",
            add: diff.toAdd,
            remove: diff.toRemove,
            modify: diff.toModify,
            defaultSortingFieldChanged,
        };
    }
    async exists() {
        return await this.axios({
            method: "GET",
            url: `/collections/${this.collectionName}`,
        })
            .then(() => true)
            .catch((e) => {
            if (e.status === 404)
                return false;
            throw e;
        });
    }
    async getRemote() {
        const { data } = await this.axios({
            method: "GET",
            url: `/collections/${this.collectionName}`,
        });
        return data;
    }
    diff(remote) {
        const remoteByName = new Map(remote.map((f) => [f.name, f]));
        const localByName = new Map(this.localFields.map((f) => [f.name, f]));
        const toAdd = [];
        const toRemove = [];
        const toModify = [];
        for (const local of this.localFields) {
            if (local.name === "id")
                continue;
            const remoteField = remoteByName.get(local.name);
            if (!remoteField) {
                toAdd.push(local);
                continue;
            }
            if (this.fieldsMatch(local, remoteField))
                continue;
            toModify.push(local);
        }
        for (const remoteField of remote) {
            if (remoteField.name === "id")
                continue;
            if (remoteField.name.includes("."))
                continue;
            if (localByName.has(remoteField.name))
                continue;
            toRemove.push(remoteField);
        }
        return { toAdd, toRemove, toModify };
    }
    fieldsMatch(local, remote) {
        for (const key of COMPARABLE_KEYS) {
            if (this.fieldValue(local, key) !== this.fieldValue(remote, key)) {
                return false;
            }
        }
        return true;
    }
    fieldValue(field, key) {
        switch (key) {
            case "facet": {
                return field.facet ?? false;
            }
            case "index": {
                return field.index ?? true;
            }
            case "optional": {
                return field.optional ?? false;
            }
            case "sort": {
                return field.sort ?? DEFAULT_SORT_TYPES.has(field.type);
            }
            case "type": {
                return field.type;
            }
        }
    }
    async patch(diff) {
        const fields = [];
        for (const field of diff.toRemove) {
            fields.push({ name: field.name, drop: true });
        }
        for (const field of diff.toModify) {
            fields.push({ name: field.name, drop: true });
            fields.push(field);
        }
        for (const field of diff.toAdd) {
            fields.push(field);
        }
        await this.axios({
            method: "PATCH",
            url: `/collections/${this.collectionName}`,
            data: { fields },
        }).catch(() => {
            throw new Error("SCHEMA_RECREATE_REQUIRED");
        });
    }
    async create() {
        const enable_nested_fields = this.localFields.some((f) => NESTED_TYPES.has(f.type));
        await this.axios({
            method: "POST",
            url: "/collections",
            data: {
                name: this.collectionName,
                fields: this.localFields,
                default_sorting_field: this.defaultSortingField,
                enable_nested_fields,
            },
        });
    }
}
