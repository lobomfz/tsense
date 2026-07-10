import type { FilterFor } from "../src/types.js";
import { UsersCollection } from "./helpers.js";
import type { User } from "./helpers.js";

// --- Direct values ---
const _exact_string: FilterFor<User> = { name: "Alice" };
const _exact_number: FilterFor<User> = { age: 22 };
const _array_string: FilterFor<User> = { name: ["Alice", "Bob"] };
const _array_number: FilterFor<User> = { age: [22, 30] };

// --- String operators on string fields ---
const _string_not: FilterFor<User> = { name: { not: "Alice" } };
const _string_notIn: FilterFor<User> = { name: { notIn: ["a"] } };

// --- Number operators on number fields ---
const _number_not: FilterFor<User> = { age: { not: 22 } };
const _number_gt: FilterFor<User> = { age: { gt: 18 } };
const _number_gte: FilterFor<User> = { age: { gte: 18 } };
const _number_lt: FilterFor<User> = { age: { lt: 65 } };
const _number_lte: FilterFor<User> = { age: { lte: 65 } };
const _number_notIn: FilterFor<User> = { age: { notIn: [22, 30] } };
const _number_range: FilterFor<User> = { age: { gte: 18, lte: 65 } };

// --- Enum field accepts union values ---
const _enum_direct: FilterFor<User> = { company: "netflix" };
const _enum_array: FilterFor<User> = { company: ["netflix", "google"] };

// --- OR ---
const _or: FilterFor<User> = { OR: [{ age: 22 }, { name: "Alice" }] };

type UpsertInput = Parameters<typeof UsersCollection.upsert>[0];
const _valid_upsert: UpsertInput = { age: 22, name: "Alice" };
// @ts-expect-error - upsert should not accept null values
const _bad_upsert_null: UpsertInput = { age: 22, name: "Alice", company: null };

// --- Undeclared keys ---
// @ts-expect-error - undeclared key 'min' on NumberFilter
const _bad_undeclared_min: FilterFor<User> = { age: { min: 25 } };
// @ts-expect-error - undeclared key 'max' on NumberFilter
const _bad_undeclared_max: FilterFor<User> = { age: { max: 100 } };

// --- Cross-type restrictions ---
// @ts-expect-error - string field does not accept gt
const _bad_string_gt: FilterFor<User> = { name: { gt: 5 } };
// @ts-expect-error - string field does not accept lte
const _bad_string_lte: FilterFor<User> = { name: { lte: 10 } };
// @ts-expect-error - string field does not accept contains
const _bad_string_contains: FilterFor<User> = { name: { contains: "Ali" } };
// @ts-expect-error - string field does not accept gt
const _bad_string_gt2: FilterFor<User> = { name: { gt: 5 } };

void [
  _exact_string,
  _exact_number,
  _array_string,
  _array_number,
  _bad_undeclared_min,
  _bad_undeclared_max,
  _string_not,
  _string_notIn,
  _number_not,
  _number_gt,
  _number_gte,
  _number_lt,
  _number_lte,
  _number_notIn,
  _number_range,
  _enum_direct,
  _enum_array,
  _or,
  _valid_upsert,
  _bad_upsert_null,
  _bad_string_gt,
  _bad_string_lte,
  _bad_string_contains,
  _bad_string_gt2,
];
