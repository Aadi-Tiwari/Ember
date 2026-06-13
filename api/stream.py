import asyncio
import json
from fastapi import WebSocket, WebSocketDisconnect
from analyzers import timing, frequency, latency, social, volume
from engine.anomaly_filter import filter_readings
from engine.signal_fusion import fuse
from engine.predictor import predict_days, find_divergence_day


async def _stream_sensor(ws: WebSocket, fn, arg) -> object:
    loop = asyncio.get_event_loop()
    reading = await loop.run_in_executor(None, fn, arg)
    await ws.send_text(json.dumps({
        "type": "sensor",
        "label": reading.label,
        "score": reading.score,
        "finding": reading.finding,
        "confidence": round(reading.confidence, 2),
        "zscore": round(getattr(reading, "zscore", 0.0), 2),
    }))
    return reading


async def handle(ws: WebSocket):
    """
    WebSocket handler. Runs all sensors in parallel, streams each result,
    then sends the final fused score with attention weights and divergence day.
    """
    await ws.accept()
    try:
        payload = json.loads(await ws.receive_text())
        metadata = payload.get("metadata", {})
        sentiment_text = payload.get("sentiment_text", "")

        tasks = [
            _stream_sensor(ws, timing, metadata),
            _stream_sensor(ws, frequency, metadata),
            _stream_sensor(ws, latency, metadata),
            _stream_sensor(ws, social, metadata),
            _stream_sensor(ws, volume, metadata),
        ]

        if sentiment_text.strip():
            from analyzers import sentiment
            tasks.append(_stream_sensor(ws, sentiment, sentiment_text))

        readings = await asyncio.gather(*tasks)
        filtered = filter_readings(list(readings))
        risk_score, attention_weights = fuse(filtered)
        days = predict_days(risk_score, metadata)
        divergence_days_ago = find_divergence_day(metadata)

        await ws.send_text(json.dumps({
            "type": "final",
            "risk_score": risk_score,
            "days_to_threshold": days,
            "attention_weights": attention_weights,
            "divergence_days_ago": divergence_days_ago,
        }))

    except WebSocketDisconnect:
        pass
