# SiftOps — Internal Knowledge Base

AI-powered search and retrieval over 36 internal policy PDFs across 5 departments. Combines vector search (OpenAI embeddings + Qdrant) with a RAG chat assistant that answers questions grounded in source documents.

**Live:** [siftops-frontend-production.up.railway.app](https://siftops-frontend-production.up.railway.app)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Railway                              │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Frontend    │───▶│   Backend    │───▶│   Qdrant     │   │
│  │   (Next.js)   │    │  (FastAPI)   │    │ (Vector DB)  │   │
│  └──────────────┘    └──────┬───────┘    └──────────────┘   │
│                             │                               │
└─────────────────────────────┼───────────────────────────────┘
                              │
                              ▼
                     ┌──────────────┐
                     │  OpenAI API  │
                     │  embeddings  │
                     │  + chat      │
                     └──────────────┘
```

| Service | Tech | Role |
|---------|------|------|
| **Frontend** | Next.js 14, Tailwind CSS, Lucide icons | Document browser, search UI, chat assistant |
| **Backend** | FastAPI, Python 3.11 | PDF ingestion, chunking, embedding, search, RAG chat |
| **Qdrant** | qdrant/qdrant (Docker) | Vector storage and similarity search |
| **OpenAI** | text-embedding-3-small, gpt-4o-mini | Embeddings and grounded answer generation |

## Data

36 PDFs across 5 sectors bundled in `siftops_dataset/data/`:

| Sector | Docs | Examples |
|--------|------|----------|
| HR | 8 | Remote Work Policy, Employee Handbook, Code of Conduct |
| Finance | 7 | Expenses Policy, Travel Policy, Approval Matrix |
| Legal | 6 | Data Retention, GDPR Guide, Anti-Bribery Policy |
| Security / IT | 7 | Password & MFA Policy, Incident Response, Access Control |
| Product / Eng | 8 | Architecture Overview, Deployment Runbook, SLA & Escalation |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/documents` | List all PDFs by sector |
| `POST` | `/reindex` | Ingest all PDFs into Qdrant |
| `GET` | `/search?q=...&limit=5` | Vector similarity search |
| `POST` | `/chat` | RAG chat with citations (`{q, top_k, min_score}`) |

## Project Structure

```
sift-drive/
├── backend/
│   └── app.py              # FastAPI app — routes, chunking, embedding, Qdrant calls
├── frontend/
│   ├── app/
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Main page — sidebar + tab switcher
│   │   └── globals.css      # Tailwind base styles
│   ├── components/
│   │   ├── Sidebar.tsx      # Document tree, refresh, reindex
│   │   ├── SearchTab.tsx    # Search input + expandable result cards
│   │   └── AssistantTab.tsx # RAG chat with citations
│   └── package.json
├── siftops_dataset/
│   ├── data/                # 36 PDFs in 5 sector folders
│   └── docs_manifest.json   # Document metadata
├── requirements.txt         # Python dependencies
├── Procfile                 # Railway start command (backend)
├── nixpacks.toml            # Build config
└── .python-version          # Python 3.11
```

## Local Development

**Backend:**
```bash
pip install -r requirements.txt
# Set OPENAI_API_KEY and QDRANT_URL in environment
python -m backend.app
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Deployment

Both services are deployed on [Railway](https://railway.com) in the `sift-drive` project. The backend deploys from the repo root via Procfile; the frontend deploys from the `frontend/` directory as a separate service.

After first deploy, hit `POST /reindex` to ingest all PDFs into Qdrant.
