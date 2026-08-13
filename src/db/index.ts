import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Drizzle database client (Postgres via postgres.js).
 *
 * Server-only. Connects as a single application role — multi-tenancy is
 * enforced in the query layer (always scope by organizationId), not by RLS.
 * Use Neon's pooled connection string in DATABASE_URL for serverless.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL");
}

// Reuse the client across hot reloads in dev to avoid exhausting connections.
const globalForDb = globalThis as unknown as { client?: ReturnType<typeof postgres> };
const client = globalForDb.client ?? postgres(connectionString, { prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
export { schema };
