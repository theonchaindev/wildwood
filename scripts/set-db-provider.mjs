// Switches the Prisma datasource provider at build time so the same repo can
// run on SQLite locally and Postgres in production.
// Set DB_PROVIDER=postgresql (plus a Postgres DATABASE_URL) on Vercel.
import { readFileSync, writeFileSync } from "fs";

const provider = process.env.DB_PROVIDER ?? "sqlite";
const path = new URL("../prisma/schema.prisma", import.meta.url);
const schema = readFileSync(path, "utf8");
const updated = schema.replace(/provider = "(sqlite|postgresql)"/, `provider = "${provider}"`);
if (updated !== schema) {
  writeFileSync(path, updated);
  console.log(`[db] provider set to ${provider}`);
}
