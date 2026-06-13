import asyncio
import json
from fastapi import WebSocket, WebSocketDisconnect
from analyzers import timing, frequency, latency, social, volume
from engine.anomaly_filter import filter_readings
from engine.signal_fusion import fuse
from engine.predictor import predict_days


async def _stream_sensor(ws: WebSocket, label: str, fn, arg) -> object:
    """
    Runs one sensor and immediately streams its result to the frontend.
    Each card on the dashboard populates as soon as its sensor finishes.
    """
    loop = asyncio.get_event_loop()
    reading = await loop.run_in_executor(None, fn, arg)

    await ws.send_text(json.dumps({
        "type": "sensor",
        "label": reading.label,
        "score": reading.score,
        "finding": reading.finding,
        "confidence": round(reading.confidence, 2),
    }))

    return reading


async def handle(ws: WebSocket):
    """
    WebSocket handler. Receives metadata JSON, runs all sensors in parallel,
    streams each result back as it completes, then sends the final fused score.
    """
    await ws.accept()

    try:
        payload = json.loads(await ws.receive_text())
        metadata = payload.get("metadata", {})
        sentiment_text = payload.get("sentiment_text", "")

        tasks = [
            _stream_sensor(ws, "Timing", timing, metadata),
            _stream_sensor(ws, "Frequency", frequency, metadata),
            _stream_sensor(ws, "Latency", latency, metadata),
            _stream_sensor(ws, "Social Graph", social, metadata),
            _stream_sensor(ws, "Volume", volume, metadata),
        ]

        if sentiment_text.strip():
            from analyzers import sentiment
            tasks.append(_stream_sensor(ws, "Sentiment", sentiment, sentiment_text))

        readings = await asyncio.gather(*tasks)

        filtered = filter_readings(list(readings))
        risk_score = fuse(filtered)
        days = predict_days(risk_score, metadata)

        # Send the final fused result
        await ws.send_text(json.dumps({
            "type": "final",
            "risk_score": risk_score,
            "days_to_threshold": days,
        }))

    except WebSocketDisconnect:
        pass
