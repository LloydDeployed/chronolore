import "../loadEnv.js";

import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString);

const TABLES = [
  "cross_references",
  "external_sources",
  "dynamic_table_rows",
  "dynamic_tables",
  "article_identities",
  "infobox_fields",
  "infoboxes",
  "passage_revisions",
  "passages",
  "passage_containers",
  "sections",
  "articles",
  "article_types",
  "user_progress",
  "universe_roles",
  "reveal_points",
  "segments",
  "entries",
  "series",
  "universes",
  "users",
];

async function reset() {
  console.log("Resetting Chronolore database...");
  await client.unsafe(
    `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
  console.log("✓ Database cleared");
  await client.end();
}

reset().catch(async (error) => {
  console.error("Database reset failed:", error);
  await client.end({ timeout: 1 }).catch(() => undefined);
  process.exit(1);
});
