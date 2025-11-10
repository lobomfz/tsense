## TSense (WIP)

Opinionated, fully-typed typesense client

# TO-DO
- [ ] Remove base typesense dependency
- [ ] Better filter support (includes, exact, etc...)
- [ ] Documentation
- [ ] Improve tests
- [ ] Facet

# Example
```typescript
import { Client } from "typesense";
import { TSense } from "tsense";

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
		// specify the typesense type directly as a string
		email: "string",
		age: "int32",
		// suffix it with a "?" to mark as optional
		phone: "string?",
		name: {
			type: "string",
			sort: true,
		},
		company: {
			type: "string",
			override: {} as "netflix" | "google",
			facet: true,
			optional: true,
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
typeof UsersCollection.infer;
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

const results = await UsersCollection.searchDocuments({
	search: "john",
	search_keys: ["name"],
	// can sort multiple fields
	order_by: ["age desc", "name asc"],
	// compiles into
	// age:>=20&&((email:=@google.com)||(email:=@netflix.com))
	filter: {
		// min and max range on numbers
		age: {
			min: 20,
		},
		// OR syntax similar to prisma
		OR: [
			{
				email: "@google.com",
			},
			{
				email: "@netflix.com",
			},
		],
	},
});

/*
   typed as
   count: number;
   data: {
        id?: string | undefined;
        phone?: string | null | undefined;
        ...
	}[];
   facet: {
        netflix: number;
        google: number;
		// enabled by enable_facet_total
        total: number;
    };
 */
const faceted = await UsersCollection.searchDocuments(
	{
		search: "john",
	},
	{
		facet_by: "company",
		enable_facet_total: true,
	},
);
```