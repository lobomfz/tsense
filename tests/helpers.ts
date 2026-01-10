import { type } from "arktype";
import { TSense } from "../src/index";

const UserSchema = type({
	"id?": "string",
	email: "string",
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
	connection: {
		host: "127.0.0.1",
		port: 8108,
		protocol: "http",
		apiKey: "123",
	},
	defaultSearchField: "name",
});

export type User = typeof UserSchema.infer;
