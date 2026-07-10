import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import {
  isRelativeDate,
  resolveRelativeDate,
} from "../src/filters/relative-dates";
import { UsersCollection } from "./helpers";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "America/Sao_Paulo";
const NOW = new Date("2026-04-08T15:30:00Z");

describe("isRelativeDate", () => {
  it("detects startOf", () => {
    expect(isRelativeDate({ startOf: "day" })).toBe(true);
  });

  it("detects endOf", () => {
    expect(isRelativeDate({ endOf: "month" })).toBe(true);
  });

  it("rejects Date objects", () => {
    expect(isRelativeDate(new Date())).toBe(false);
  });

  it("rejects filter operator objects", () => {
    expect(isRelativeDate({ gte: new Date() })).toBe(false);
  });

  it("rejects primitives", () => {
    expect(isRelativeDate("day")).toBe(false);
    expect(isRelativeDate(123)).toBe(false);
    expect(isRelativeDate(null)).toBe(false);
  });

  it("survives JSON round-trip", () => {
    const original = { startOf: "day" as const };
    const roundTripped = JSON.parse(JSON.stringify(original));
    expect(isRelativeDate(roundTripped)).toBe(true);
  });
});

describe("resolveRelativeDate", () => {
  it("resolves startOf day", () => {
    const result = resolveRelativeDate({ startOf: "day" }, TZ, NOW);
    const expected = dayjs(NOW).tz(TZ).startOf("day").toDate();
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("resolves endOf day", () => {
    const result = resolveRelativeDate({ endOf: "day" }, TZ, NOW);
    const expected = dayjs(NOW).tz(TZ).endOf("day").toDate();
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("resolves startOf week", () => {
    const result = resolveRelativeDate({ startOf: "week" }, TZ, NOW);
    const expected = dayjs(NOW).tz(TZ).startOf("week").toDate();
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("resolves endOf week", () => {
    const result = resolveRelativeDate({ endOf: "week" }, TZ, NOW);
    const expected = dayjs(NOW).tz(TZ).endOf("week").toDate();
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("resolves startOf month", () => {
    const result = resolveRelativeDate({ startOf: "month" }, TZ, NOW);
    const expected = dayjs(NOW).tz(TZ).startOf("month").toDate();
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("resolves endOf month", () => {
    const result = resolveRelativeDate({ endOf: "month" }, TZ, NOW);
    const expected = dayjs(NOW).tz(TZ).endOf("month").toDate();
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("timezone affects the result", () => {
    const sp = resolveRelativeDate(
      { startOf: "day" },
      "America/Sao_Paulo",
      NOW,
    );
    const tokyo = resolveRelativeDate({ startOf: "day" }, "Asia/Tokyo", NOW);
    expect(sp.getTime()).not.toBe(tokyo.getTime());
  });

  it("midnight boundary — late night in SP is next day in UTC", () => {
    const lateNightUtc = new Date("2026-04-08T01:30:00Z");
    const result = resolveRelativeDate(
      { startOf: "day" },
      "America/Sao_Paulo",
      lateNightUtc,
    );

    const expected = dayjs(lateNightUtc)
      .tz("America/Sao_Paulo")
      .startOf("day")
      .toDate();
    expect(result.getTime()).toBe(expected.getTime());
  });
});

describe("integration — search with relative dates", () => {
  const today = dayjs().tz(TZ).startOf("day");
  const yesterday = today.subtract(1, "day");
  const tomorrow = today.add(1, "day");

  beforeAll(async () => {
    await UsersCollection.drop().catch(() => null);
    await UsersCollection.create();

    await UsersCollection.upsert([
      {
        id: "rd-1",
        name: "Today User",
        age: 25,
        created_at: today.add(10, "hour").toDate(),
      },
      {
        id: "rd-2",
        name: "Yesterday User",
        age: 30,
        created_at: yesterday.add(10, "hour").toDate(),
      },
      {
        id: "rd-3",
        name: "Tomorrow User",
        age: 35,
        created_at: tomorrow.add(10, "hour").toDate(),
      },
    ]);
  });

  afterAll(async () => {
    await UsersCollection.drop().catch(() => null);
  });

  it("filters with startOf day as direct value", async () => {
    const result = await UsersCollection.search({
      filter: { created_at: { gte: { startOf: "day" } } },
    });

    const names = result.data.map((d) => d.name).sort();
    expect(names).toContain("Today User");
    expect(names).toContain("Tomorrow User");
    expect(names).not.toContain("Yesterday User");
  });

  it("filters with relative date range (startOf..endOf day)", async () => {
    const result = await UsersCollection.search({
      filter: {
        created_at: {
          gte: { startOf: "day" },
          lte: { endOf: "day" },
        },
      },
    });

    expect(result.data.length).toBe(1);
    expect(result.data[0].name).toBe("Today User");
  });

  it("mixes relative and concrete dates", async () => {
    const result = await UsersCollection.search({
      filter: {
        created_at: { gte: { startOf: "day" } },
        age: 25,
      },
    });

    expect(result.data.length).toBe(1);
    expect(result.data[0].name).toBe("Today User");
  });

  it("non-date values pass through unchanged", async () => {
    const result = await UsersCollection.search({
      filter: { name: "Today User" },
    });

    expect(result.data.length).toBe(1);
    expect(result.data[0].age).toBe(25);
  });
});
