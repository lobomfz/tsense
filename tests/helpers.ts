import { Client } from "typesense";
import { TSense } from "../src/index";

export const client = new Client({
	nodes: [
		{
			host: "127.0.0.1",
			port: 8108,
			protocol: "http",
		},
	],
	apiKey: "123",
	connectionTimeoutSeconds: 2,
});

export const UsersCollection = new TSense("users", {
	client,
	fields: {
		//  specify the typesense type directly
		email: "string",
		age: "int32",
		// suffix it with a "?" to mark as optional
		phone: "string?",
		// or
		name: {
			type: "string",
			sort: true,
		},
		work_history: {
			// object and object[] auto-infers enable_nested_fields
			type: "object[]",
			index: false,
			optional: true,
			override: {} as {
				company: string;
				date: string;
			}[],
		},
	},
	default_search_field: "name",
});

// infer the collection type (undefined at runtime)
// typeof UsersCollection.infer;
/*
 {
     id?: string | undefined;
     phone?: string | null | undefined;
     work_history?: {
         company: string;
         date: string;
     }[] | null | undefined;
     email: string;
     age: number;
     name: string;
 }
 */

// await UsersCollection.delete().catch(() => null);
// await UsersCollection.create();

// const results = await UsersCollection.searchDocuments({
// 	search: "john",
// 	search_keys: ["name"],
// 	// can sort multiple fields
// 	order_by: ["age desc", "name asc"],
// 	// compiles into
// 	// age:>=20&&((email:=@google.com)||(email:=@netflix.com))
// 	filter: {
// 		// min and max range on numbers
// 		age: {
// 			min: 20,
// 		},
// 		// OR syntax similar to prisma
// 		OR: [
// 			{
// 				email: "@google.com",
// 			},
// 			{
// 				email: "@netflix.com",
// 			},
// 		],
// 	},
// });
