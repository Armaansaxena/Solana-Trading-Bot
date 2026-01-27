import { defineConfig, env } from "prisma/config";
import "dotenv/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // The ! tells TS to ignore the 'undefined' warning
    url: env("DATABASE_URL")!, 
  },
});