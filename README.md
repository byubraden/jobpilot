# JobPilot

JobPilot is a local application workspace for saving job descriptions, reviewing AI-assisted preparation, and tracking application status. It does not discover jobs or submit applications. Review every generated suggestion before using it.

## Local setup

1. Install Node.js 20.9 or newer and npm. From this directory, run `npm install`.
2. Install [Ollama](https://ollama.com/download), start the Ollama app or run `ollama serve`, then download the default model:

   ```bash
   ollama pull qwen3:8b
   ```

3. Create your local configuration:

   ```bash
   cp .env.example .env.local
   ```

   The example selects `qwen3:8b` at `http://127.0.0.1:11434` and stores data in `./data/jobpilot.sqlite`. Change `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, or `DATABASE_PATH` in `.env.local` if your setup differs. The provider picker in the app determines which provider runs for each job; `AI_PROVIDER` in the example file does not override that choice.

4. Start JobPilot with `npm run dev` and open [http://localhost:3000](http://localhost:3000). Create a candidate profile using only facts you can verify, then paste a job description of at least 200 characters. Choose **Ollama · local** to run the three agents. The saved job shows fit analysis, résumé suggestions, an application draft, and status controls.

The SQLite database is created automatically at the configured `DATABASE_PATH`, relative to the project directory unless you provide an absolute path. The default file is `data/jobpilot.sqlite`; it is ignored by Git. Back it up before deleting it. Set a different `DATABASE_PATH` to keep separate workspaces.

## Other providers and privacy

**Demo · mock mode** runs deterministic fixtures and does not call an AI provider. Its score of 82 and extracted job facts are sample data, not a real assessment. The browser test uses this mode and a fresh temporary database.

**Ollama · local** sends the profile and job description to the Ollama server configured by `OLLAMA_BASE_URL`; the default server is on this computer. Saved profile, posting, results, and run metadata remain in the local SQLite database.

**Claude · Anthropic API** is optional. Add `ANTHROPIC_API_KEY` to `.env.local`, select Claude in the app, and review API pricing before running it. This selection sends your profile and job description to Anthropic and uses API credit. Never commit `.env.local` or paste a real API key into a sample profile, job, or issue report.

## Checks

```bash
npm test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
```

Install the Playwright browser once with `npx playwright install chromium` if `npm run test:e2e` reports a missing executable. The browser test starts its own local development server on port 3109 and uses a new database under the operating system's temporary directory. It selects mock mode, so Ollama and an API key are not needed for this check.

## Troubleshooting

- **Ollama unavailable:** Confirm the server is running, `OLLAMA_BASE_URL` is reachable, and `ollama list` includes the model named by `OLLAMA_MODEL`. The default health check is `curl http://127.0.0.1:11434/api/tags`. Start Ollama or correct the model and retry the failed agent from the saved job.
- **AI response did not match the expected format:** The provider returned data that failed validation. Open the saved job and use its Retry button for the failed step. If this repeats, confirm the selected model and server are healthy; you can also run the deterministic mock mode to check the rest of the workflow. Do not treat an incomplete draft as ready to send.
- **No results after saving a job:** Save a candidate profile first. The job remains in the pipeline; open it and run analysis after saving the profile.
