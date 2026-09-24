CREATE TABLE IF NOT EXISTS candidate_profiles (
  id INTEGER PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE CHECK (version > 0),
  headline TEXT NOT NULL,
  education_json TEXT NOT NULL,
  internships_json TEXT NOT NULL,
  projects_json TEXT NOT NULL,
  skills_json TEXT NOT NULL,
  preferences TEXT,
  resume_text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'found' CHECK (status IN ('found', 'reviewing', 'ready', 'applied', 'interviewing', 'rejected', 'offer')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);
CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON jobs(created_at);

CREATE TABLE IF NOT EXISTS agent_runs (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('fit', 'resume', 'application')),
  provider TEXT NOT NULL CHECK (provider IN ('ollama', 'claude', 'mock')),
  model TEXT NOT NULL,
  profile_version INTEGER NOT NULL REFERENCES candidate_profiles(version),
  attempt_id INTEGER NOT NULL DEFAULT 1 CHECK (attempt_id > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  error TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS agent_runs_job_id_idx ON agent_runs(job_id);

CREATE TABLE IF NOT EXISTS fit_analyses (
  job_id INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  profile_version INTEGER NOT NULL REFERENCES candidate_profiles(version),
  attempt_id INTEGER NOT NULL DEFAULT 1 CHECK (attempt_id > 0),
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resume_suggestions (
  job_id INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  profile_version INTEGER NOT NULL REFERENCES candidate_profiles(version),
  attempt_id INTEGER NOT NULL DEFAULT 1 CHECK (attempt_id > 0),
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS application_drafts (
  job_id INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  profile_version INTEGER NOT NULL REFERENCES candidate_profiles(version),
  attempt_id INTEGER NOT NULL DEFAULT 1 CHECK (attempt_id > 0),
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
