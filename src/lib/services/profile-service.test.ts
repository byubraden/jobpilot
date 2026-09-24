import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { revalidatePath } from "next/cache";
import { createDatabase } from "../db/connection";
import { ProfileRepository } from "../db/repositories";
import { ProfileService } from "./profile-service";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const candidate = {
  headline: "Junior software engineer",
  education: ["Computer Science degree"],
  internships: [],
  projects: [],
  skills: ["TypeScript"],
  resumeText: "Built a production web application.",
};

let db: Database.Database;
let service: ProfileService;

beforeEach(() => {
  db = createDatabase(":memory:");
  service = new ProfileService(new ProfileRepository(db));
});
afterEach(() => {
  db.close();
  vi.unstubAllEnvs();
});

describe("ProfileService", () => {
  it("validates before saving and does not advance the version for invalid input", () => {
    expect(() => service.saveProfile({ ...candidate, skills: [] })).toThrow();
    expect(service.getCurrentProfile()).toBeNull();
    expect(service.saveProfile(candidate).version).toBe(1);
  });

  it("increments the profile version on each save", () => {
    service.saveProfile(candidate);
    const updated = service.saveProfile({ ...candidate, headline: "Software engineer" });
    expect(updated.version).toBe(2);
    expect(service.getCurrentProfile()).toEqual(updated);
  });
});

describe("profile server action", () => {
  it("returns serializable field errors for invalid form input", async () => {
    const { saveProfileAction } = await import("../../app/actions");
    const form = new FormData();
    form.set("headline", "Junior software engineer");
    form.set("education", "Computer Science degree");
    form.set("skills", "");
    form.set("resumeText", "Built a production web application.");

    const result = await saveProfileAction(form);

    expect(result).toMatchObject({ ok: false, fieldErrors: { skills: expect.any(Array) } });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("saves valid form data and revalidates the profile page", async () => {
    vi.stubEnv("DATABASE_PATH", ":memory:");
    const { saveProfileAction } = await import("../../app/actions");
    const form = new FormData();
    form.set("headline", "Junior software engineer");
    form.set("education", "Computer Science degree");
    form.set("skills", "TypeScript\nReact");
    form.set("resumeText", "Built a production web application.");

    const result = await saveProfileAction(form);

    expect(result).toMatchObject({ ok: true, data: { version: 1, skills: ["TypeScript", "React"] } });
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
    expect(existsSync(resolve(":memory:"))).toBe(false);
  });
});
