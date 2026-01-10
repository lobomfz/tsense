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
	]);
});

afterAll(async () => {
	await collection.drop().catch(() => null);
});

describe("search result fields", () => {
	describe("scores", () => {
		it("should return scores array with same length as data", async () => {
			const result = await collection.search({
				query: "Alice",
			});

			expect(result.scores).toBeDefined();
			expect(Array.isArray(result.scores)).toBe(true);
			expect(result.scores.length).toBe(result.data.length);
		});

		it("should return positive relevance scores for matching results", async () => {
			const result = await collection.search({
				query: "Alice",
			});

			expect(result.scores.length).toBeGreaterThan(0);
			expect(result.scores[0]).toBeGreaterThan(0);
		});

		it("should return scores as numbers", async () => {
			const result = await collection.search({
				query: "Bob",
			});

			for (const score of result.scores) {
				expect(typeof score).toBe("number");
			}
		});

		it("should return empty scores array when no results", async () => {
			const result = await collection.search({
				query: "NonExistentUser",
			});

			expect(result.scores).toBeDefined();
			expect(result.scores.length).toBe(0);
			expect(result.data.length).toBe(0);
		});

		it("should return multiple scores for multiple results", async () => {
			const result = await collection.search({});

			expect(result.scores.length).toBe(result.data.length);
			expect(result.scores.length).toBeGreaterThan(1);
		});
	});

	describe("facets structure", () => {
		it("should return facets object with requested facet field", async () => {
			const result = await collection.search({
				facetBy: ["company"],
			});

			expect(result.facets).toBeDefined();
			expect(result.facets.company).toBeDefined();
		});

		it("should return facet counts as numbers", async () => {
			const result = await collection.search({
				facetBy: ["company"],
			});

			expect(typeof result.facets.company.netflix).toBe("number");
			expect(typeof result.facets.company.google).toBe("number");
		});

		it("should return correct facet counts", async () => {
			const result = await collection.search({
				facetBy: ["company"],
			});

			expect(result.facets.company.netflix).toBe(2);
			expect(result.facets.company.google).toBe(1);
		});

		it("should return empty facets when facetBy is not specified", async () => {
			const result = await collection.search({
				query: "Alice",
			});

			expect(result.facets).toBeDefined();
		});
	});

	describe("combined result fields", () => {
		it("should return all result fields together", async () => {
			const result = await collection.search({
				query: "Alice",
				facetBy: ["company"],
			});

			expect(result.count).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.scores).toBeDefined();
			expect(result.facets).toBeDefined();

			expect(result.scores.length).toBe(result.data.length);
		});
	});
});
