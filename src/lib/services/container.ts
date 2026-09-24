import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { MockProvider } from "../ai/mock-provider";
import { OllamaProvider } from "../ai/ollama-provider";
import { AnthropicProvider } from "../ai/anthropic-provider";
import type { AIProvider } from "../ai/provider";
import { createDatabase } from "../db/connection";
import {
  AgentRunRepository, ApplicationDraftRepository, FitAnalysisRepository, JobRepository,
  ProfileRepository, ResumeSuggestionsRepository,
} from "../db/repositories";
import { JobWorkflowCoordinator } from "../workflow/coordinator";
import { JobService } from "./job-service";
import { ProfileService } from "./profile-service";

// "anthropic" is the configuration choice; its provider will record "claude" in run metadata.
export type ProviderSelectionKind = "ollama" | "anthropic" | "mock";

export function createProvider(providerKind: ProviderSelectionKind): AIProvider {
  switch (providerKind) {
    case "mock": return new MockProvider();
    case "ollama": return new OllamaProvider({
      baseUrl: process.env.OLLAMA_BASE_URL,
      model: process.env.OLLAMA_MODEL,
    });
    case "anthropic": return new AnthropicProvider({
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      model: process.env.ANTHROPIC_MODEL,
    });
    default:
      throw new Error("Unknown AI provider selection.");
  }
}

export function parseProviderSelection(value: unknown): ProviderSelectionKind {
  if (value === "mock" || value === "ollama" || value === "anthropic") return value;
  throw new Error("Select an AI provider.");
}

export type ServiceContainer = {
  profiles: ProfileService;
  jobs: JobService;
};

let container: ServiceContainer | undefined;

export function getServices(): ServiceContainer {
  if (container) return container;
  const configuredPath = process.env.DATABASE_PATH ?? "./data/jobpilot.sqlite";
  const path = configuredPath === ":memory:" ? configuredPath : resolve(/* turbopackIgnore: true */ configuredPath);
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = createDatabase(path);
  const profiles = new ProfileRepository(db);
  const jobs = new JobRepository(db);
  const runs = new AgentRunRepository(db);
  const fitResults = new FitAnalysisRepository(db);
  const resumeResults = new ResumeSuggestionsRepository(db);
  const applicationDrafts = new ApplicationDraftRepository(db);
  container = {
    profiles: new ProfileService(profiles),
    jobs: new JobService({
      profiles, jobs, runs, fitResults, resumeResults, applicationDrafts,
      createCoordinator(providerKind) {
        return new JobWorkflowCoordinator({
          provider: createProvider(providerKind), profiles, jobs, runs, fitResults, resumeResults, applicationDrafts,
        });
      },
    }),
  };
  return container;
}
