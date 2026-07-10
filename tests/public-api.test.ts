import { beforeAll, describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import { $ } from "bun";

const ROOT = resolve(import.meta.dir, "..");

beforeAll(async () => {
  const result = await $`bun run build`.cwd(ROOT).nothrow();

  expect(result.exitCode).toBe(0);
});

describe("public API", () => {
  it("exports filters subpath", async () => {
    const filters = await import("tsense/filters");

    expect(typeof filters.createFilterBuilder).toBe("function");
    expect(typeof filters.serializeFilter).toBe("function");
    expect(typeof filters.deserializeFilter).toBe("function");
  });

  it("exports react subpath", async () => {
    const react = await import("tsense/react");

    expect(typeof react.FilterBuilder).toBe("function");
    expect(typeof react.useFilterBuilder).toBe("function");
  });
});
