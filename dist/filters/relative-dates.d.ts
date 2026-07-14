import type { RelativeDate } from "../types.js";
export declare function isRelativeDate(value: unknown): value is RelativeDate;
export declare function resolveRelativeDate(expr: RelativeDate, tz: string, now?: Date): Date;
