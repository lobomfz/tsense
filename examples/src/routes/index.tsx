import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { FilterBuilder } from "tsense/react";
import { describe } from "../api/describe" with { type: "macro" };
import { orpc } from "../client";

const descriptor = describe();

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function useSearchResults(query: string, filter: typeof descriptor.infer) {
  return useSuspenseQuery(
    orpc.search.queryOptions({
      input: { query, filter },
      placeholderData: (previous) => previous,
    }),
  );
}

function ResultsSection({
  query,
  filter,
}: {
  query: string;
  filter: typeof descriptor.infer;
}) {
  const { data: results } = useSearchResults(query, filter);

  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-gray-500">
        Results ({results.count})
      </h2>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="pb-2">Name</th>
            <th className="pb-2">Email</th>
            <th className="pb-2">Age</th>
            <th className="pb-2">Company</th>
            <th className="pb-2">Active</th>
            <th className="pb-2">Joined At</th>
          </tr>
        </thead>
        <tbody>
          {results.data.map((user, index) => (
            <tr key={index} className="border-b">
              <td className="py-2">{user.name}</td>
              <td className="py-2">{user.email}</td>
              <td className="py-2">{user.age}</td>
              <td className="py-2">{user.company}</td>
              <td className="py-2">{user.active ? "Yes" : "No"}</td>
              <td className="py-2">
                {user.joined_at ? user.joined_at.toLocaleDateString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IndexPage() {
  const [filter, setFilter] = useState<typeof descriptor.infer>({});
  const [query, setQuery] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">tsense filter builder</h1>

      <input
        className="rounded-lg border px-4 py-2"
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-500">Filters</h2>
        <FilterBuilder descriptor={descriptor} onChange={setFilter} />
      </div>

      <Suspense
        fallback={
          <div className="text-sm text-gray-500">Loading results...</div>
        }
      >
        <ResultsSection query={query} filter={filter} />
      </Suspense>
    </div>
  );
}
