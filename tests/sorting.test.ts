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
	await collection.drop().catch(() => null);
});

describe("sorting", () => {
	it("should sort by field ascending", async () => {
		const result = await collection.search({
			sortBy: ["age:asc"],
			limit: 50,
		});

		for (let i = 1; i < result.data.length; i++) {
			expect(result.data[i].age).toBeGreaterThanOrEqual(result.data[i - 1].age);
		}
	});

	it("should sort by field descending", async () => {
		const result = await collection.search({
			sortBy: ["age:desc"],
			limit: 50,
		});

		for (let i = 1; i < result.data.length; i++) {
			expect(result.data[i].age).toBeLessThanOrEqual(result.data[i - 1].age);
		}
	});

	it("should sort by field with explicit direction", async () => {
		const result = await collection.search({
			sortBy: ["age:asc"],
			limit: 50,
		});

		for (let i = 1; i < result.data.length; i++) {
			expect(result.data[i].age).toBeGreaterThanOrEqual(result.data[i - 1].age);
		}
	});

	it("should sort by multiple fields", async () => {
		const result = await collection.search({
			sortBy: ["age:desc", "name:asc"],
			limit: 50,
		});

		expect(result.data.length).toBeGreaterThan(0);
	});

	it("should sort by text relevance score", async () => {
		const result = await collection.search({
			query: "Alice",
			sortBy: ["score:desc"],
			limit: 50,
		});

		expect(result.data.length).toBeGreaterThan(0);
	});

	it("should sort by age descending", async () => {
		const result = await collection.search({
			sortBy: ["age:desc"],
			limit: 10,
		});

		expect(result.data.length).toBeGreaterThan(0);
		for (let i = 1; i < result.data.length; i++) {
			expect(result.data[i].age).toBeLessThanOrEqual(result.data[i - 1].age);
		}
	});

	it("should ignore undefined entries in order_by array", async () => {
		const result = await collection.search({
			sortBy: ["undefined", "age:asc"] as any,
			limit: 10,
		});

		// Should still sort by age asc, ignoring the undefined entry
		expect(result.data.length).toBeGreaterThan(0);
		for (let i = 1; i < result.data.length; i++) {
			expect(result.data[i].age).toBeGreaterThanOrEqual(result.data[i - 1].age);
		}
	});

	it("should sort by string field (name asc)", async () => {
		const result = await collection.search({
			sortBy: ["name:asc"],
			limit: 10,
		});

		expect(result.data.length).toBeGreaterThan(0);
		expect(result.data[0].name).toBe("Alice");

		// Verify alphabetical ordering
		for (let i = 1; i < result.data.length; i++) {
			expect(result.data[i].name >= result.data[i - 1].name).toBe(true);
		}
	});

	it("should sort by optional string field (email asc)", async () => {
		const result = await collection.search({
			sortBy: ["email:asc"],
			limit: 10,
		});

		expect(result.data.length).toBeGreaterThan(0);
		expect(result.data[0].email).toBe("alice@example.com");

		// Verify alphabetical ordering
		for (let i = 1; i < result.data.length; i++) {
			const prev = result.data[i - 1].email;
			const curr = result.data[i].email;
			if (prev && curr) {
				expect(curr >= prev).toBe(true);
			}
		}
	});

	it("should generate sort: true for optional string fields with configure", () => {
		const emailField = collection.fields.find((f) => f.name === "email");
		expect(emailField).toBeDefined();
		expect(emailField?.optional).toBe(true);
		expect(emailField?.sort).toBe(true);
	});
});
