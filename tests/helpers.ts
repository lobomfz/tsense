import { type } from "arktype";
import { TSense } from "../src/index";
import { connection } from "./config";

const UserSchema = type({
	"id?": "string",
	"email?": type("string").configure({
		sort: true,
	}),
	age: type("number.integer").configure({
		type: "int32",
		facet: false,
		sort: true,
		index: true,
	}),
	"company?": type.enumerated("netflix", "google").configure({
		type: "string",
		facet: true,
		sort: false,
		index: true,
	}),
	"phone?": "string",
	name: type("string").configure({
		type: "string",
		facet: false,
		sort: true,
		index: true,
	}),
	"work_history?": type({
		company: "string",
		date: "string",
	})
		.array()
		.configure({
			type: "object[]",
			facet: false,
			sort: false,
			index: false,
		}),
});

export const UsersCollection = new TSense({
	name: "users",
	schema: UserSchema,
	connection,
	defaultSearchField: "name",
});

export type User = typeof UserSchema.infer;
