import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { UsersCollection as collection } from "./helpers";

beforeAll(async () => {
	await collection.drop().catch(() => null);
	await collection.create();

	// Seed test data
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
	]);
});

afterAll(async () => {
	await collection.drop().catch(() => null);
});

describe("error handling", () => {
	it("should reject unknown order_by field", async () => {
		await expect(
			collection.search({
				sortBy: ["nonexistent_field:asc"] as any,
			}),
		).rejects.toThrow();
	});

	it("should reject unknown filter field", async () => {
		await expect(
			collection.search({
				filter: { nonexistent_field: "value" } as any,
			}),
		).rejects.toThrow();
	});
});
