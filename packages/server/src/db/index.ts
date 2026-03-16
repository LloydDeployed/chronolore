import { config } from "dotenv";
config(); // loads .env from cwd (packages/server/)

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString);

export const db = drizzle(client, { schema });

/** Verify database connectivity. Call at server startup. */
export async function checkConnection(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    const url = new URL(connectionString);
    console.log(`✓ Database connected (${url.hostname}:${url.port}/${url.pathname.slice(1)})`);
    return true;
  } catch (err: any) {
    console.error(`✗ Database connection failed: ${err.message}`);
    console.error(`  URL: ${connectionString.replace(/\/\/.*@/, '//<redacted>@')}`);
    console.error(`  Is the database running? (docker compose up -d db)`);
    return false;
  }
}
