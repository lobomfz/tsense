import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { UsersCollection as collection } from "./helpers";

beforeAll(async () => {
	await collection.drop().catch(() => null);
	await collection.create();

	await collection.upsert([
		{
			id: "1",
			name: "Alice Johnson",
			email: "alice@netflix.com",
			age: 28,
			company: "netflix",
		},
		{
			id: "2",
			name: "Bob Smith",
			email: "bob@google.com",
			age: 35,
			company: "google",
		},
		{
			id: "3",
			name: "Charlie Davis",
			email: "charlie@netflix.com",
			age: 42,
			company: "netflix",
		},
		{
			id: "4",
			name: "Diana Wilson",
			email: "diana@google.com",
			age: 31,
			company: "google",
		},
		{
			id: "5",
			name: "Eve Brown",
			email: "eve@netflix.com",
			age: 29,
			company: "netflix",
		},
	]);
});

afterAll(async () => {
	await collection.drop().catch(() => null);
});

describe("faceting", () => {
	it("should return facet counts by company", async () => {
		const result = await collection.search({
			facetBy: ["company"],
		});

		expect(result.count).toBe(5);
		expect(result.facets).toBeDefined();
		expect(result.facets.company.netflix).toBe(3);
		expect(result.facets.company.google).toBe(2);
	});

	it("should return facet counts with search query", async () => {
		const result = await collection.search({
			query: "Alice",
			facetBy: ["company"],
		});

		expect(result.count).toBeGreaterThan(0);
		expect(result.facets).toBeDefined();
		expect(result.facets.company.netflix).toBe(1);
		expect(result.facets.company.google).toBeUndefined();
	});

	it("should return facet counts with filters", async () => {
		const result = await collection.search({
			filter: {
				age: {
					min: 30,
				},
			},
			facetBy: ["company"],
		});

		expect(result.count).toBe(3);
		expect(result.facets).toBeDefined();
		expect(result.facets.company.netflix).toBe(1);
		expect(result.facets.company.google).toBe(2);
	});

	it("should return facet counts for single company filter", async () => {
		const result = await collection.search({
			filter: {
				company: "netflix",
			},
			facetBy: ["company"],
		});

		expect(result.count).toBe(3);
		expect(result.facets).toBeDefined();
		expect(result.facets.company.netflix).toBe(3);
		expect(result.facets.company.google).toBeUndefined();
	});

	it("should return empty facets when no results match", async () => {
		const result = await collection.search({
			query: "NonExistentName",
			facetBy: ["company"],
		});

		expect(result.count).toBe(0);
		expect(result.facets).toBeDefined();
		expect(result.data.length).toBe(0);
	});
});
