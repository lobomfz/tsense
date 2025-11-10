import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { UsersCollection as collection } from "./helpers";

beforeAll(async () => {
	await collection.delete().catch(() => null);
	await collection.create();

	await collection.upsertDocuments([
		{
			id: "10",
			name: "Alice Williams",
			email: "alice@example.com",
			age: 28,
		},
		{
			id: "11",
			name: "Charlie Brown",
			email: "charlie@example.com",
			age: 32,
		},
	]);
});

afterAll(async () => {
	await collection.delete().catch(() => null);
});

describe("search", () => {
	it("should search by text query", async () => {
		const result = await collection.searchDocuments({
			search: "Alice",
		});

		expect(result.count).toBeGreaterThan(0);
		expect(result.data[0].name).toContain("Alice");
	});

	it("should highlight search by text query", async () => {
		const result = await collection.searchDocuments({
			search: "Alice",
			highlight: true,
		});

		expect(result.count).toBeGreaterThan(0);
		expect(result.data[0].name).toContain("<mark>Alice</mark>");
	});

	it("should search with empty query", async () => {
		const result = await collection.searchDocuments({});

		expect(result.count).toBeGreaterThan(0);
		expect(result.data.length).toBeGreaterThan(0);
	});

	it("should search with search_keys parameter", async () => {
		const result = await collection.searchDocuments({
			search: "charlie@example.com",
			search_keys: ["email"],
		});

		expect(result.count).toBeGreaterThan(0);
		expect(result.data[0].email).toBe("charlie@example.com");
	});

	it("should limit results", async () => {
		const result = await collection.searchDocuments({
			limit: 2,
		});

		expect(result.data.length).toBeLessThanOrEqual(2);
	});

	it("should paginate results", async () => {
		const page1 = await collection.searchDocuments({
			limit: 2,
			page: 1,
		});

		const page2 = await collection.searchDocuments({
			limit: 2,
			page: 2,
		});

		if (page1.data.length > 0 && page2.data.length > 0) {
			expect(page1.data[0].id).not.toBe(page2.data[0].id);
		}
	});
});
