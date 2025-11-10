import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { UsersCollection as collection } from "./helpers";

beforeAll(async () => {
	await collection.delete().catch(() => null);
	await collection.create();

	// Seed test data
	await collection.upsertDocuments([
		{
			id: "1",
			name: "Alice Johnson",
			email: "alice.johnson@example.com",
			age: 25,
		},
		{
			id: "2",
			name: "Bob Smith",
			email: "bob.smith@example.com",
			age: 30,
		},
		{
			id: "3",
			name: "Charlie Davis",
			email: "charlie.davis@example.com",
			age: 35,
		},
		{
			id: "4",
			name: "David Wilson",
			email: "david.wilson@example.com",
			age: 40,
		},
		{
			id: "5",
			name: "Eve Brown",
			email: "eve.brown@example.com",
			age: 45,
		},
	]);
});

afterAll(async () => {
	await collection.delete().catch(() => null);
});

describe("search parameters", () => {
	it("should support multiple search_keys", async () => {
		const result = await collection.searchDocuments({
			search: "johnson",
			search_keys: ["email", "name"],
		});

		expect(result.count).toBeGreaterThan(0);
		expect(result.data[0].name).toBe("Alice Johnson");
	});

	it("should tolerate highlight flag without breaking", async () => {
		const result = await collection.searchDocuments({
			search: "Bob",
			highlight: true,
		});

		expect(result.count).toBeGreaterThan(0);
		expect(result.data[0].name).toContain("Bob");
	});

	it("should return empty data for very large page number", async () => {
		const result = await collection.searchDocuments({
			page: 9999,
			limit: 10,
		});

		// Should not throw, just return empty results
		expect(result.data.length).toBe(0);
	});
});
