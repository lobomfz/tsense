import type { AxiosInstance } from "./tsense.js";
import type { FieldSchema } from "./types.js";

type SchemaDiff = {
  toAdd: FieldSchema[];
  toRemove: FieldSchema[];
  toModify: FieldSchema[];
};

type CollectionResponse = {
  fields: FieldSchema[];
  default_sorting_field?: string;
  enable_nested_fields?: boolean;
};

const COMPARABLE_KEYS = ["type", "facet", "sort", "index", "optional"] as const;
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
  constructor(
    private collectionName: string,
    private localFields: readonly FieldSchema[],
    private defaultSortingField: string | undefined,
    private axios: AxiosInstance,
  ) {}

  async sync(): Promise<void> {
    const exists = await this.exists();

    if (!exists) {
      return await this.create();
    }

    const remote = await this.getRemote();

    if (
      (remote.default_sorting_field || undefined) !==
      (this.defaultSortingField ?? undefined)
    ) {
      throw new Error("SCHEMA_RECREATE_REQUIRED");
    }

    const diff = this.diff(remote.fields);

    if (!diff.toAdd.length && !diff.toRemove.length && !diff.toModify.length) {
      return;
    }

    await this.patch(diff);
  }

  private async exists(): Promise<boolean> {
    return await this.axios({
      method: "GET",
      url: `/collections/${this.collectionName}`,
    })
      .then(() => true)
      .catch((e: { status?: number }) => {
        if (e.status === 404) return false;
        throw e;
      });
  }

  private async getRemote(): Promise<CollectionResponse> {
    const { data } = await this.axios<CollectionResponse>({
      method: "GET",
      url: `/collections/${this.collectionName}`,
    });

    return data;
  }

  private diff(remote: FieldSchema[]): SchemaDiff {
    const remoteByName = new Map(remote.map((f) => [f.name, f]));
    const localByName = new Map(this.localFields.map((f) => [f.name, f]));

    const toAdd: FieldSchema[] = [];
    const toRemove: FieldSchema[] = [];
    const toModify: FieldSchema[] = [];

    for (const local of this.localFields) {
      if (local.name === "id") continue;

      const remoteField = remoteByName.get(local.name);

      if (!remoteField) {
        toAdd.push(local);
        continue;
      }

      if (this.fieldsMatch(local, remoteField)) continue;

      toModify.push(local);
    }

    for (const remoteField of remote) {
      if (remoteField.name === "id") continue;
      if (remoteField.name.includes(".")) continue;
      if (localByName.has(remoteField.name)) continue;

      toRemove.push(remoteField);
    }

    return { toAdd, toRemove, toModify };
  }

  private fieldsMatch(local: FieldSchema, remote: FieldSchema): boolean {
    for (const key of COMPARABLE_KEYS) {
      if (this.fieldValue(local, key) !== this.fieldValue(remote, key)) {
        return false;
      }
    }

    return true;
  }

  private fieldValue(
    field: FieldSchema,
    key: (typeof COMPARABLE_KEYS)[number],
  ) {
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

  private async patch(diff: SchemaDiff): Promise<void> {
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

  private async create(): Promise<void> {
    const enable_nested_fields = this.localFields.some((f) =>
      NESTED_TYPES.has(f.type),
    );

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
