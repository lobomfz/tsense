import { afterEach, describe, expect, it } from "bun:test";
import { type } from "arktype";
import redaxios from "redaxios";
import { TSense } from "../src/index";
import { connection } from "./config";

const axios = (redaxios as { default?: typeof redaxios }).default ?? redaxios;

const baseURL = `${connection.protocol}://${connection.host}:${connection.port}`;
const headers = { "X-TYPESENSE-API-KEY": connection.apiKey };

const dropCollection = async (name: string) => {
	await axios({
		method: "DELETE",
		baseURL,
		url: `/collections/${name}`,
		headers,
	}).catch(() => null);
};

const getDocumentCount = async (name: string) => {
	return await axios<{ num_documents: number }>({
		method: "GET",
		baseURL,
		url: `/collections/${name}`,
		headers,
	})
		.then((res) => res.data.num_documents)
		.catch(() => 0);
};

const schema = type({
	"id?": "string",
	name: "string",
	age: "number.integer",
});

type Item = typeof schema.infer;

describe("syncData", () => {
	const collectionName = "sync_data_test";

	afterEach(async () => {
		await dropCollection(collectionName);
	});

	it("throws if sync not configured", async () => {
		const collection = new TSense({
			name: collectionName,
			schema,
			connection,
			defaultSearchField: "name",
		});

		await collection.create();

		expect(collection.syncData()).rejects.toThrow("DATA_SYNC_NOT_CONFIGURED");
	});

	it("syncs all items from source", async () => {
		const sourceData: Item[] = [
			{ id: "1", name: "Alice", age: 30 },
			{ id: "2", name: "Bob", age: 25 },
			{ id: "3", name: "Charlie", age: 35 },
		];

		const collection = new TSense({
			name: collectionName,
			schema,
			connection,
			defaultSearchField: "name",
			dataSync: {
				getAllIds: async () => sourceData.map((d) => d.id!),
				getItems: async (ids) => sourceData.filter((d) => ids.includes(d.id!)),
			},
		});

		await collection.create();
		const result = await collection.syncData();

		expect(result.upserted).toBe(3);
		expect(result.failed).toBe(0);
		expect(result.deleted).toBe(0);

		const count = await getDocumentCount(collectionName);
		expect(count).toBe(3);
	});

	it("syncs specific ids when provided", async () => {
		const sourceData: Item[] = [
			{ id: "1", name: "Alice", age: 30 },
			{ id: "2", name: "Bob", age: 25 },
			{ id: "3", name: "Charlie", age: 35 },
		];

		const collection = new TSense({
			name: collectionName,
			schema,
			connection,
			defaultSearchField: "name",
			dataSync: {
				getAllIds: async () => sourceData.map((d) => d.id!),
				getItems: async (ids) => sourceData.filter((d) => ids.includes(d.id!)),
			},
		});

		await collection.create();
		const result = await collection.syncData({ ids: ["1", "2"] });

		expect(result.upserted).toBe(2);

		const count = await getDocumentCount(collectionName);
		expect(count).toBe(2);
	});

	it("purges orphan documents", async () => {
		const collection = new TSense({
			name: collectionName,
			schema,
			connection,
			defaultSearchField: "name",
			dataSync: {
				getAllIds: async () => ["1", "2"],
				getItems: async (ids) =>
					[
						{ id: "1", name: "Alice", age: 30 },
						{ id: "2", name: "Bob", age: 25 },
					].filter((d) => ids.includes(d.id!)),
			},
		});

		await collection.create();

		await collection.upsert([
			{ id: "1", name: "Alice", age: 30 },
			{ id: "2", name: "Bob", age: 25 },
			{ id: "3", name: "Orphan", age: 99 },
		]);

		const countBefore = await getDocumentCount(collectionName);
		expect(countBefore).toBe(3);

		const result = await collection.syncData({ purge: true });

		expect(result.deleted).toBe(1);

		const countAfter = await getDocumentCount(collectionName);
		expect(countAfter).toBe(2);

		const orphan = await collection.get("3");
		expect(orphan).toBeNull();
	});

	it("handles empty source gracefully", async () => {
		const collection = new TSense({
			name: collectionName,
			schema,
			connection,
			defaultSearchField: "name",
			dataSync: {
				getAllIds: async () => [],
				getItems: async () => [],
			},
		});

		await collection.create();
		const result = await collection.syncData();

		expect(result.upserted).toBe(0);
		expect(result.deleted).toBe(0);
		expect(result.failed).toBe(0);
	});

	it("respects chunkSize option", async () => {
		const sourceData: Item[] = Array.from({ length: 10 }, (_, i) => ({
			id: String(i + 1),
			name: `User ${i + 1}`,
			age: 20 + i,
		}));

		let getItemsCalls = 0;

		const collection = new TSense({
			name: collectionName,
			schema,
			connection,
			defaultSearchField: "name",
			dataSync: {
				getAllIds: async () => sourceData.map((d) => d.id!),
				getItems: async (ids) => {
					getItemsCalls++;
					return sourceData.filter((d) => ids.includes(d.id!));
				},
			},
		});

		await collection.create();
		await collection.syncData({ chunkSize: 3 });

		expect(getItemsCalls).toBe(4);
	});

	it("updates existing documents", async () => {
		const collection = new TSense({
			name: collectionName,
			schema,
			connection,
			defaultSearchField: "name",
			dataSync: {
				getAllIds: async () => ["1"],
				getItems: async () => [{ id: "1", name: "Alice Updated", age: 31 }],
			},
		});

		await collection.create();

		await collection.upsert({ id: "1", name: "Alice", age: 30 });

		const before = await collection.get("1");
		expect(before?.name).toBe("Alice");

		await collection.syncData();

		const after = await collection.get("1");
		expect(after?.name).toBe("Alice Updated");
		expect(after?.age).toBe(31);
	});

	it("purges all when source is empty", async () => {
		const collection = new TSense({
			name: collectionName,
			schema,
			connection,
			defaultSearchField: "name",
			dataSync: {
				getAllIds: async () => [],
				getItems: async () => [],
			},
		});

		await collection.create();

		await collection.upsert([
			{ id: "1", name: "Alice", age: 30 },
			{ id: "2", name: "Bob", age: 25 },
		]);

		const result = await collection.syncData({ purge: true });

		expect(result.deleted).toBe(2);

		const count = await getDocumentCount(collectionName);
		expect(count).toBe(0);
	});

	it("respects chunkSize from sync config", async () => {
		const sourceData: Item[] = Array.from({ length: 10 }, (_, i) => ({
			id: String(i + 1),
			name: `User ${i + 1}`,
			age: 20 + i,
		}));

		let getItemsCalls = 0;

		const collection = new TSense({
			name: collectionName,
			schema,
			connection,
			defaultSearchField: "name",
			dataSync: {
				getAllIds: async () => sourceData.map((d) => d.id!),
				getItems: async (ids) => {
					getItemsCalls++;
					return sourceData.filter((d) => ids.includes(d.id!));
				},
				chunkSize: 2,
			},
		});

		await collection.create();
		await collection.syncData();

		expect(getItemsCalls).toBe(5);
	});
});
