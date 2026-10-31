import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { TABLES } from "./schema-tables";

const SCHEMA_PATH = path.join(process.cwd(), "lib", "schema.sql");

export function dataDir(): string {
  return process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), "data");
}

function resolveDbFile(): string {
  return path.join(dataDir(), "app.db");
}

let cached: { db: Database.Database; file: string } | null = null;

/** Shared connection for the running process (dev server, API routes, seed). */
export function getDb(): Database.Database {
  const file = resolveDbFile();
  if (cached && cached.file === file) return cached.db;

  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  cached = { db, file };
  return db;
}

/** Creates the schema when the database has none, so the app runs before `npm run seed`. */
export function ensureSchema(db: Database.Database = getDb()): void {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='products'")
    .get() as { n: number };
  if (row.n > 0) return;
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

export function createDbFile(): Database.Database {
  const file = resolveDbFile();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(file);
  db.pragma("foreign_keys = ON");
  return db;
}

export function dropAllData(db: Database.Database): void {
  db.pragma("foreign_keys = OFF");
  for (const table of TABLES) db.exec(`DROP TABLE IF EXISTS ${table}`);
  db.pragma("foreign_keys = ON");
}

export function applySchema(db: Database.Database): void {
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function uuid(): string {
  return crypto.randomUUID();
}
