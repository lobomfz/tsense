import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import type { RelativeDate } from "../types.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export function isRelativeDate(value: unknown): value is RelativeDate {
  if (typeof value !== "object" || value === null || value instanceof Date) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    ("startOf" in obj && typeof obj.startOf === "string") ||
    ("endOf" in obj && typeof obj.endOf === "string")
  );
}

export function resolveRelativeDate(
  expr: RelativeDate,
  tz: string,
  now?: Date,
): Date {
  const base = now ? dayjs(now).tz(tz) : dayjs().tz(tz);

  if ("startOf" in expr) {
    return base.startOf(expr.startOf).toDate();
  }

  return base.endOf(expr.endOf).toDate();
}
