import json
from fastapi import FastAPI, UploadFile, File, Form, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from data.parser import parse_export, load_sample
from api.stream import handle

app = FastAPI(title="PulseCheck")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/parse")
async def parse_file(file: UploadFile = File(...)):
    """Accepts a Discord/Slack JSON export and returns stripped metadata."""
    raw = json.loads(await file.read())
    metadata = parse_export(raw)
    return {
        "recent_count": len(metadata["recent"]),
        "baseline_count": len(metadata["baseline"]),
        "metadata": {
            "recent": [
                {**m, "timestamp": m["timestamp"].isoformat()}
                for m in metadata["recent"]
            ],
            "baseline": [
                {**m, "timestamp": m["timestamp"].isoformat()}
                for m in metadata["baseline"]
            ],
        },
    }


@app.get("/demo/{scenario}")
async def demo(scenario: str):
    """
    Returns pre-loaded demo metadata for the one-click demo mode.
    scenario: 'healthy' or 'crisis'
    """
    if scenario not in ("healthy", "crisis"):
        return {"error": "scenario must be healthy or crisis"}

    metadata = load_sample(scenario)
    return {
        "metadata": {
            "recent": [
                {**m, "timestamp": m["timestamp"].isoformat()}
                for m in metadata["recent"]
            ],
            "baseline": [
                {**m, "timestamp": m["timestamp"].isoformat()}
                for m in metadata["baseline"]
            ],
        }
    }


@app.websocket("/ws/analyze")
async def websocket_analyze(ws: WebSocket):
    """Real-time analysis stream. Sends each sensor result as it completes."""
    await handle(ws)


@app.get("/health")
async def health():
    return {"status": "ok"}
