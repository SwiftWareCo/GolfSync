// src/server/db/index.ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import * as relations from "./relations";
import { config } from "dotenv";

config({ path: ".env" }); // or .env.local

// Use environment variable directly
if (!process.env.POSTGRES_URL) {
  throw new Error("POSTGRES_URL environment variable is not defined");
}

const sql = neon(process.env.POSTGRES_URL);
export const db = drizzle(sql, { schema: { ...schema, ...relations } });
