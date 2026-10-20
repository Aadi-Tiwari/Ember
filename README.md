# Ember

AI agents assess burnout risk from your check-in, activity, face, voice, and chat, with evidence, a conditional outlook, and practical next steps.

Built by [Aadi Tiwari](https://github.com/Aadi-Tiwari).

## Start with an assessment

Open `/evaluate`, complete the check-in form, and run the assessment. A camera and microphone are not required. To add session context, choose **Collect session signals first** on the landing page, start collection from the dashboard, enable the inputs you want, then choose **Start a check-in**. Select which captured measurements and chat message to include before submitting.

The report includes a concern level, the observations supporting it, a conditional outlook, uncertainties, practical next steps, and follow-up questions. You can inspect each agent's review and download the full report as JSON. Reports are held in page memory until you leave or download them.

## How the agents work

1. The **context agent** reviews your reported exhaustion, detachment, reduced effectiveness, duration, and recovery.
2. The **signal agent** examines the available measurements and competing explanations. These first two reviews run concurrently.
3. The **assessment agent** reconciles the reviews into a structured assessment and an outlook conditioned on the current demands and recovery continuing.

All roles use the configured language model. Each response is schema-validated; findings must cite evidence supplied to that role. Reference validation establishes provenance, not the truth of a model's interpretation. Missing configuration, malformed output, unknown references, and provider failures return an explicit error, never a substitute assessment.

The check-in is primary evidence. Measurements from a brief session cannot establish a personal baseline or a longitudinal trend. The legacy signal indices remain available in the live API for inspection; the agent assessment does not use them as clinical scores. Their fusion is a deterministic weighted average with heuristic weights and requires no embedding-model download.

Live measurements remain eligible for an assessment for 30 seconds and the latest chat message for 15 minutes. Opening the check-in captures the available evidence into a fixed snapshot, usable for 15 minutes. These windows control evidence freshness; expired data can remain in memory until replaced, cleared, or the backend stops. Starting a new collection session clears previous events and snapshots.

## Run locally

Use Python 3.11 and Node.js 22.

```sh
python -m venv .venv
```

Activate `.venv` (`.venv\Scripts\Activate.ps1` in PowerShell or `source .venv/bin/activate` on macOS/Linux), then:

```sh
python -m pip install -r requirements-dev.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

The assessment team requires a configured language provider. Copy `.env.example` to the ignored `.env` file and supply your existing Groq credential as `GROQ_API_KEY`. The existing OpenAI fallback remains supported; Groq takes priority when both providers are configured. `EMBER_AI_MODEL` overrides the default model for the selected provider. The model must support JSON-object responses through Chat Completions. Never put credentials in frontend variables or source files.

Set `EMBER_JWT_SECRET` to a private random value if you use local accounts and want login sessions to survive restarts. Otherwise the server generates a temporary signing secret.

In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open <http://localhost:3000>. `GET /health` reports backend health, and `GET /api/assessment/status` reports provider configuration without contacting the provider. Configured does not mean a provider request has succeeded.

The frontend defaults to `http://localhost:8000`. `NEXT_PUBLIC_API_URL` in `frontend/.env.local` selects a different backend. The WebSocket follows that URL; use `NEXT_PUBLIC_API_WS_LIVE` only for a separate socket endpoint. Local frontend origins are allowed by the backend's CORS configuration.

## API

| Route | Purpose |
| --- | --- |
| `POST /api/session` | Clear local events and start a fresh collection session. |
| `POST /ingest` | Submit activity, facial, voice, or chat observations. |
| `WS /ws/live` | Stream current measurements and heuristic signal summaries. |
| `POST /api/chat` | Talk through workload, recovery, and burnout concerns. |
| `GET /api/assessment/status` | Check configuration and available sources. |
| `POST /api/assessment/context` | Freeze current evidence for a check-in. |
| `POST /api/assess` | Run the reviews and combined assessment. |

`POST /api/assess` accepts `check_in`, `include_signals`, `include_chat`, and `context_id`. A captured context is required only when including sensor or chat evidence. See `/docs` on the backend for request fields and response schemas. Failed requests use HTTP 422 for invalid input, 409 for an expired snapshot, 503 for missing configuration or rejected provider credentials, and 502 for other provider or response failures.

## Data handling

The local backend is a single-user workspace. Accounts do not isolate its event store, and collection and assessment routes do not enforce per-user authorization. Run it bound to loopback. Multi-user hosting needs isolated storage, authorization, and usage controls.

Camera frames and microphone audio are processed in the browser. Derived measurements go to the local backend. Chat sends conversation text to the configured provider. Assessment sends the check-in and only the additional evidence selected on the form. Evidence snapshots and chat are kept in backend memory; account records persist in SQLite. The application does not log assessment contents. Downloaded reports contain the selected evidence and should be treated as personal information.

The desktop collector in `monitor/` is a separate opt-in process. Review it before enabling collection. MediaPipe assets and frontend fonts/backgrounds are fetched from their respective hosts.

## Prediction scope

Ember's outlook is a model interpretation of a check-in under stated conditions. It is not a learned forecast with a measured accuracy, a probability, an onset date, or a validated clinical diagnosis. The custom questions are not a validated questionnaire. A clinically useful predictor would need a defined outcome, longitudinal labeled data, evaluation on held-out participants, and professional review.

The [WHO description of occupational burnout](https://www.who.int/standards/classifications/frequently-asked-questions/burn-out-an-occupational-phenomenon) informs the work-related dimensions. Study and other stress contexts are distinguished in the agent instructions. Facial observations have important contextual limits, as discussed in [this research review](https://www.psychologicalscience.org/journals/pspi/1529100619832930/).

## Deployment

The frontend can be built separately with project root `frontend`. It still requires a reachable Python backend, compatible HTTP/WebSocket security, and an allowed frontend origin. Removing the old embedding dependencies reduces backend weight, but a deployable multi-user service is outside the current local architecture. A deployed landing page alone does not provide working assessments.

## Checks

```sh
python -m pytest -q
```

From `frontend/`:

```sh
npm run build
```

Tests exercise account routes, ingestion, chat, the agent pipeline with a simulated provider, schema failures, evidence references, opt-in selection, frozen snapshots, expiry, and reset behavior. Simulated provider tests prove orchestration and failure handling, not model accuracy or clinical validity.

## Source map

- `main.py`: FastAPI routes and provider connection.
- `engine/assessment.py`: check-in, agent roles, evidence, and report validation.
- `engine/event_store.py`: current observations and fixed assessment snapshots.
- `analyzers/`: legacy heuristic indices for the live API.
- `frontend/app/evaluate/`: check-in and assessment report.
- `frontend/app/page.tsx`: landing page.
- `frontend/app/dashboard/`: session collection workspace.
- `auth/`, `db/`: local account support.

## License

Copyright 2026 Aadi Tiwari. Original source is available under the [MIT License](LICENSE). Third-party dependencies, model weights, fonts, and other assets retain their own licenses.
