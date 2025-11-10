import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { UsersCollection as collection } from "./helpers";

beforeAll(async () => {
	await collection.delete().catch(() => null);
	await collection.create();

	await collection.upsertDocuments([
		{
			id: "1",
			name: "Alice",
			email: "alice@example.com",
			age: 25,
		},
		{
			id: "2",
			name: "Bob",
			email: "bob@example.com",
			age: 30,
		},
		{
			id: "3",
			name: "Charlie",
			email: "charlie@example.com",
			age: 35,
		},
	]);
});

afterAll(async () => {
	await collection.delete().catch(() => null);
});

describe("combined operations", () => {
	it("should search with filter and sort", async () => {
		const result = await collection.searchDocuments({
			search: "example.com",
			search_keys: ["email"],
			filter: { age: { min: 25 } },
			order_by: ["age asc"],
			limit: 10,
		});

		for (const doc of result.data) {
			expect(doc.age).toBeGreaterThanOrEqual(25);
			expect(doc.email).toContain("example.com");
		}
	});

	it("should filter and sort with pagination", async () => {
		const result = await collection.searchDocuments({
			filter: { age: { min: 25 } },
			order_by: ["age desc"],
			page: 1,
			limit: 5,
		});

		for (const doc of result.data) {
			expect(doc.age).toBeGreaterThanOrEqual(25);
		}

		expect(result.data.length).toBeLessThanOrEqual(5);
	});
});
