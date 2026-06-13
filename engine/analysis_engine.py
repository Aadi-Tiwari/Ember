import asyncio
from dataclasses import dataclass
from analyzers import timing, frequency, latency, social, volume
from engine.anomaly_filter import filter_readings
from engine.signal_fusion import fuse
from engine.predictor import predict_days


@dataclass
class AnalysisResult:
    readings: list
    risk_score: int
    days_to_threshold: int | None


async def _run_sensor(fn, arg) -> object:
    """Runs a synchronous sensor in a thread pool to keep the event loop free."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, fn, arg)


async def analyze(metadata: dict, sentiment_text: str = "") -> AnalysisResult:
    """
    Dispatches all sensors simultaneously using asyncio.gather.
    Total processing time = slowest single sensor, not the sum of all sensors.
    """
    tasks = [
        _run_sensor(timing, metadata),
        _run_sensor(frequency, metadata),
        _run_sensor(latency, metadata),
        _run_sensor(social, metadata),
        _run_sensor(volume, metadata),
    ]

    # Add optional sentiment sensor if the user provided text
    if sentiment_text.strip():
        from analyzers import sentiment
        tasks.append(_run_sensor(sentiment, sentiment_text))

    readings = await asyncio.gather(*tasks)
    readings = list(readings)

    filtered = filter_readings(readings)
    risk_score = fuse(filtered)
    days = predict_days(risk_score, metadata)

    return AnalysisResult(
        readings=readings,
        risk_score=risk_score,
        days_to_threshold=days,
    )
