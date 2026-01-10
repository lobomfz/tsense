import type { AxiosInstance } from "./tsense.js";
import type { FieldSchema } from "./types.js";

type SchemaDiff = {
	toAdd: FieldSchema[];
	toRemove: FieldSchema[];
	toModify: FieldSchema[];
};

type CollectionResponse = {
	fields: FieldSchema[];
};

const COMPARABLE_KEYS = ["type", "facet", "sort", "index", "optional"] as const;
const NESTED_TYPES = ["object", "object[]"];

export class TSenseMigrator {
	constructor(
		private collectionName: string,
		private localFields: FieldSchema[],
		private defaultSortingField: string | undefined,
		private axios: AxiosInstance,
	) {}

	async sync(): Promise<void> {
		const exists = await this.exists();

		if (!exists) {
			return await this.create();
		}

		const remoteFields = await this.getRemoteFields();

		const diff = this.diff(remoteFields);

		if (!diff.toAdd.length && !diff.toRemove.length && !diff.toModify.length) {
			return;
		}

		const patched = await this.patch(diff);

		if (patched) return;

		await this.drop();
		await this.create();
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

	private async getRemoteFields(): Promise<FieldSchema[]> {
		const { data } = await this.axios<CollectionResponse>({
			method: "GET",
			url: `/collections/${this.collectionName}`,
		});

		return data.fields;
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
			if (localByName.has(remoteField.name)) continue;

			toRemove.push(remoteField);
		}

		return { toAdd, toRemove, toModify };
	}

	private fieldsMatch(local: FieldSchema, remote: FieldSchema): boolean {
		for (const key of COMPARABLE_KEYS) {
			if ((local[key] ?? undefined) !== (remote[key] ?? undefined)) {
				return false;
			}
		}

		return true;
	}

	private async patch(diff: SchemaDiff): Promise<boolean> {
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

		return await this.axios({
			method: "PATCH",
			url: `/collections/${this.collectionName}`,
			data: { fields },
		})
			.then(() => true)
			.catch(() => false);
	}

	private async create(): Promise<void> {
		const enable_nested_fields = this.localFields.some((f) =>
			NESTED_TYPES.includes(f.type),
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

	private async drop(): Promise<void> {
		await this.axios({
			method: "DELETE",
			url: `/collections/${this.collectionName}`,
		});
	}
}
