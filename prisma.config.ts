import { config } from "dotenv";
import path from "path";
import { defineConfig } from "prisma/config";

const env = process.env.NODE_ENV === "production" ? "production" : "development";
config({ path: path.resolve(process.cwd(), `.env.${env}`) });

if (!process.env["DATABASE_URL"]) {
  config({ path: path.resolve(process.cwd(), ".env.development") });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
