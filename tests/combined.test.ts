import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { UsersCollection as collection } from "./helpers";

beforeAll(async () => {
	await collection.drop().catch(() => null);
	await collection.create();

	await collection.upsert([
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
	await collection.drop().catch(() => null);
});

describe("combined operations", () => {
	it("should search with filter and sort", async () => {
		const result = await collection.search({
			query: "example.com",
			queryBy: ["email"],
			filter: { age: { min: 25 } },
			sortBy: ["age:asc"],
			limit: 10,
		});

		for (const doc of result.data) {
			expect(doc.age).toBeGreaterThanOrEqual(25);
			expect(doc.email).toContain("example.com");
		}
	});

	it("should filter and sort with pagination", async () => {
		const result = await collection.search({
			filter: { age: { min: 25 } },
			sortBy: ["age:desc"],
			page: 1,
			limit: 5,
		});

		for (const doc of result.data) {
			expect(doc.age).toBeGreaterThanOrEqual(25);
		}

		expect(result.data.length).toBeLessThanOrEqual(5);
	});
});
