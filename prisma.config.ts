import { defineConfig } from "prisma/config";

const DEFAULT_DATABASE_URL =
	"postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export default defineConfig({
	schema: "prisma/schema.prisma",
	datasource: {
		url: process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL,
	},
});
