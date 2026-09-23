import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function createDatabase(path: string): Database.Database {
  const db = new Database(path);
  try {
    db.pragma("foreign_keys = ON");
    db.transaction(() => {
      db.exec(readFileSync(join(process.cwd(), "src/lib/db/schema.sql"), "utf8"));
      for (const table of ["fit_analyses", "resume_suggestions", "application_drafts"]) {
        const columns = db.pragma(`table_info(${table})`) as { name: string }[];
        if (!columns.some(({ name }) => name === "profile_version")) {
          // Historical payloads have no reliable source version; NULL records that fact.
          db.exec(`ALTER TABLE ${table} ADD COLUMN profile_version INTEGER REFERENCES candidate_profiles(version)`);
        }
      }
    })();
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
