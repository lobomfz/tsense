import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { UsersCollection as collection } from "./helpers";

beforeAll(async () => {
	await collection.drop().catch(() => null);
	await collection.create();
});

afterAll(async () => {
	await collection.drop().catch(() => null);
});

describe("upsert", () => {
	it("should upsert a single document", async () => {
		const result = await collection.upsert({
			id: "1",
			name: "John Doe",
			email: "john@example.com",
			age: 30,
		});

		expect(result).toBeDefined();
		expect(result?.[0].success).toBe(true);
	});

	it("should upsert multiple documents", async () => {
		const result = await collection.upsert([
			{
				id: "2",
				name: "Jane Smith",
				email: "jane@example.com",
				age: 25,
			},
			{
				id: "3",
				name: "John Smith",
				email: "john@example.com",
				age: 50,
			},
			{
				id: "4",
				name: "Bob Johnson",
				email: "bob@example.com",
				age: 35,
			},
		]);

		expect(result).toBeDefined();
		expect(result?.length).toBe(3);
		expect(result?.[0].success).toBe(true);
		expect(result?.[1].success).toBe(true);
	});

	it("should update existing document", async () => {
		await collection.upsert({
			id: "1",
			name: "John Doe Updated",
			email: "john.updated@example.com",
			age: 31,
		});

		const searchResult = await collection.search({
			filter: { id: "1" },
		});

		expect(searchResult.data[0].name).toBe("John Doe Updated");
		expect(searchResult.data[0].age).toBe(31);
	});

	it("should return empty array when upserting empty array", async () => {
		const result = await collection.upsert([]);

		expect(result).toEqual([]);
	});
});
