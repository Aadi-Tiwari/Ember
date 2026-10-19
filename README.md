# Ember

A local wellness dashboard that brings activity, emotion, voice, and optional chat signals into one live view.

The FastAPI service collects events and streams summaries to a Next.js interface. Optional desktop and Discord collectors feed the same event store. Scores are experimental indicators, not validated diagnoses or emergency monitoring.

## Run locally

Use Python 3.11 for the pinned backend dependencies and Node.js 22 for the interface.

```sh
python -m venv .venv
```

Activate `.venv` (`.venv\Scripts\Activate.ps1` in PowerShell or `source .venv/bin/activate` on macOS/Linux), then:

```sh
python -m pip install -r requirements-dev.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open <http://localhost:3000>. The backend health endpoint is <http://127.0.0.1:8000/health>. Registration and login use a local SQLite database created at startup.

For optional chat, copy `.env.example` to `.env` and configure `GROQ_API_KEY` or `OPENAI_API_KEY`. Groq takes priority when both are set. Set `EMBER_JWT_SECRET` to a private random value to preserve sessions across restarts. Without it, the server generates a temporary signing secret and restarting invalidates existing sessions.

The frontend defaults to `http://localhost:8000`. Override `NEXT_PUBLIC_API_URL` in `frontend/.env.local` if needed. The live WebSocket URL follows that API URL; use `NEXT_PUBLIC_API_WS_LIVE` only for a separate socket endpoint. The backend permits the local frontend origins listed in `main.py`.

## Pages

The Next.js frontend includes the landing and session page at `/`, local account access at `/login`, and saved-session evaluation at `/evaluate`. Evaluation requires an actual recorded session. Connection failures are shown in the session view; an unavailable backend must not look like a live assessment.

For Vercel frontend builds, set the project root to `frontend`. A frontend deployment alone does not provide the Python service. The root FastAPI application is intended to run locally and its ML dependencies exceed the serverless bundle limit. Use the local setup above; do not treat a successful frontend deployment as proof of a working hosted backend.

## Data and deployment limits

The live stream preserves a chat assessment when one is available and uses local sentiment analysis for plain chat events. Combining multiple signals loads the sentence-embedding model on first use and may download its assets. A single active signal does not require that model download.

This is a single-user local prototype. Login does not isolate the shared event stream, and the ingest and WebSocket endpoints are not protected by per-user authorization. Bind the backend to loopback; multi-user hosting requires separate authorization and event storage work.

Chat text is sent to the configured language provider. Chat events can contain the user's text in memory. Account records persist in local SQLite, and the frontend keeps history in browser storage. Do not describe the application as metadata-only or as storing nothing. Collector behavior is visible in `monitor/`; review it before enabling collection.

## Source map

- `main.py`: ingestion, live stream, health, and optional chat.
- `auth/` and `db/`: account routes, signed sessions, and SQLite access.
- `engine/`: shared events and signal summaries.
- `monitor/`: optional collectors.
- `frontend/`: dashboard, evaluation, and login views.

## Checks

From the root with the virtual environment active:

```sh
python -m pytest -q
```

From `frontend/`:

```sh
npm run build
```

The API tests use a temporary database and mock the chat provider. They cover account login, request validation, assessment bounds, and CORS. They do not validate the wellness scores or exercise live collectors and paid providers.

## License

Original project source is available under the [MIT License](LICENSE). Third-party dependencies, model weights, fonts, documents, and datasets retain their own licenses. This license does not grant rights to third-party assets.
