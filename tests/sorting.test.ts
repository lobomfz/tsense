import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { UsersCollection as collection } from "./helpers";

beforeAll(async () => {
	await collection.delete().catch(() => null);
	await collection.create();

	// Seed test data
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
		{
			id: "4",
			name: "David",
			email: "david@example.com",
			age: 40,
		},
	]);
});

afterAll(async () => {
	await collection.delete().catch(() => null);
});

describe("sorting", () => {
	it("should sort by field ascending", async () => {
		const result = await collection.searchDocuments({
			order_by: ["age asc"],
			limit: 50,
		});

		for (let i = 1; i < result.data.length; i++) {
			expect(result.data[i].age).toBeGreaterThanOrEqual(result.data[i - 1].age);
		}
	});

	it("should sort by field descending", async () => {
		const result = await collection.searchDocuments({
			order_by: ["age desc"],
			limit: 50,
		});

		for (let i = 1; i < result.data.length; i++) {
			expect(result.data[i].age).toBeLessThanOrEqual(result.data[i - 1].age);
		}
	});

	it("should sort by field with default direction", async () => {
		const result = await collection.searchDocuments({
			order_by: "age",
			direction: "asc",
			limit: 50,
		});

		for (let i = 1; i < result.data.length; i++) {
			expect(result.data[i].age).toBeGreaterThanOrEqual(result.data[i - 1].age);
		}
	});

	it("should sort by multiple fields", async () => {
		const result = await collection.searchDocuments({
			order_by: ["age desc", "name asc"],
			limit: 50,
		});

		expect(result.data.length).toBeGreaterThan(0);
	});

	it("should sort by text relevance score", async () => {
		const result = await collection.searchDocuments({
			search: "Alice",
			order_by: "score",
			limit: 50,
		});

		expect(result.data.length).toBeGreaterThan(0);
	});

	it("should default to desc when order_by has no direction", async () => {
		const result = await collection.searchDocuments({
			order_by: "age",
			limit: 10,
		});

		// Should be descending by default
		expect(result.data.length).toBeGreaterThan(0);
		for (let i = 1; i < result.data.length; i++) {
			expect(result.data[i].age).toBeLessThanOrEqual(result.data[i - 1].age);
		}
	});

	it("should ignore undefined entries in order_by array", async () => {
		const result = await collection.searchDocuments({
			order_by: ["undefined", "age asc"] as any,
			limit: 10,
		});

		// Should still sort by age asc, ignoring the undefined entry
		expect(result.data.length).toBeGreaterThan(0);
		for (let i = 1; i < result.data.length; i++) {
			expect(result.data[i].age).toBeGreaterThanOrEqual(result.data[i - 1].age);
		}
	});

	it("should sort by string field (name asc)", async () => {
		const result = await collection.searchDocuments({
			order_by: ["name asc"],
			limit: 10,
		});

		expect(result.data.length).toBeGreaterThan(0);
		expect(result.data[0].name).toBe("Alice");

		// Verify alphabetical ordering
		for (let i = 1; i < result.data.length; i++) {
			expect(result.data[i].name >= result.data[i - 1].name).toBe(true);
		}
	});
});
