# PulseCheck

Early burnout detection through behavioral pattern analysis. No messages read. No words processed.

## What It Does

PulseCheck analyzes the *shape* of your digital communication - when you message, how often, how fast you reply, how many people you talk to, and how much you write - to detect early signs of burnout before you realize it yourself.

Six independent sensors each analyze one behavioral dimension. When multiple sensors converge on the same pattern, a risk score is generated. Think of it as a check engine light for your mental state.

## Architecture

```
Discord/Slack Export (JSON)
         |
    [Parser] - strips all content, keeps only metadata
         |
    [Analysis Engine] - asyncio.gather() parallel dispatch
   /   |   |   |   \
[S1] [S2] [S3] [S4] [S5]   <- all sensors run simultaneously
  \   |   |   |   /
  [Signal Fusion] - MiniLM embedding-based consensus
         |
    [Anomaly Filter] - statistical outlier removal
         |
  [Risk Score 0-100]
         |
  [WebSocket Stream] -> Frontend Dashboard
```

## Sensors

| Sensor | What It Measures |
|---|---|
| Timing | When you message - detects sleep schedule drift |
| Frequency | How often - detects sustained activity dropoff |
| Latency | How fast you reply - detects social withdrawal |
| Social Graph | How many people - detects contracting social circle |
| Volume | How much you write - detects communication energy decline |
| Sentiment (optional) | Voluntary text input - VADER tone analysis |

## Privacy

- Message content is stripped immediately on upload
- Only timestamps, character counts, and anonymized channel/author hashes are processed
- No data is stored server-side
- Optional sentiment analysis only runs on text the user explicitly provides

## Setup

```bash
# Backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend (in /frontend)
npm install
npm run dev
```

## Demo Mode

Hit `GET /demo/healthy` or `GET /demo/crisis` for pre-loaded scenarios. The frontend has a one-click demo button that uses these endpoints.

## Tech Stack

- Backend: Python + FastAPI + asyncio
- Signal Fusion: sentence-transformers (MiniLM-L6-v2) + scikit-learn cosine similarity
- Sentiment: VADER
- Frontend: Next.js + Tailwind CSS + Framer Motion
- Deploy: Vercel
