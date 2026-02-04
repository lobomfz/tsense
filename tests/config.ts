export const connection = {
	host: process.env.TYPESENSE_HOST ?? "127.0.0.1",
	port: Number(process.env.TYPESENSE_PORT ?? 8108),
	protocol: (process.env.TYPESENSE_PROTOCOL ?? "http") as "http" | "https",
	apiKey: process.env.TYPESENSE_API_KEY ?? "123",
};
