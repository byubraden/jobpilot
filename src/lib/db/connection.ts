import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function createDatabase(path: string): Database.Database {
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(join(process.cwd(), "src/lib/db/schema.sql"), "utf8"));
  return db;
}
