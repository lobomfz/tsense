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
	]);
});

afterAll(async () => {
	await collection.delete().catch(() => null);
});

describe("error handling", () => {
	it("should reject unknown order_by field", () => {
		expect(async () => {
			await collection.searchDocuments({
				order_by: ["nonexistent_field asc"] as any,
			});
		}).toThrow();
	});

	it("should reject unknown filter field", () => {
		expect(async () => {
			await collection.searchDocuments({
				filter: { nonexistent_field: "value" } as any,
			});
		}).toThrow();
	});
});
