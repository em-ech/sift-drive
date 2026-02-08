import os
import re
import uuid
from pathlib import Path
from typing import Dict, List, Any

import requests
from pypdf import PdfReader
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from openai import OpenAI

# ---------------------------
# Config
# ---------------------------


from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SiftOps PDF Search", version="0.1.0")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parents[1]  # project root
DATA_DIR = Path(os.getenv("PDF_DATA_DIR", BASE_DIR / "siftops_dataset" / "data"))

QDRANT_URL = os.getenv("QDRANT_URL", "http://127.0.0.1:6333").rstrip("/")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "").strip()
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "siftops_chunks")

EMBEDDINGS_MODEL = os.getenv("EMBEDDINGS_MODEL", "text-embedding-3-small")
TOP_K_DEFAULT = int(os.getenv("TOP_K_DEFAULT", "5"))
CHAT_MODEL = os.getenv("CHAT_MODEL", "gpt-4o-mini")

# OpenAI client (reads OPENAI_API_KEY from env)
openai_client = OpenAI()

# Headers for Qdrant
QDRANT_HEADERS = {"Content-Type": "application/json"}
if QDRANT_API_KEY:
    QDRANT_HEADERS["api-key"] = QDRANT_API_KEY


# ---------------------------
# Helpers
# ---------------------------

def list_pdfs_by_sector() -> Dict[str, List[str]]:
    if not DATA_DIR.exists():
        return {}
    out: Dict[str, List[str]] = {}
    for sector_dir in sorted([p for p in DATA_DIR.iterdir() if p.is_dir()]):
        out[sector_dir.name] = sorted([f.name for f in sector_dir.glob("*.pdf")])
    return out


def extract_pdf_pages(pdf_path: Path) -> List[str]:
    reader = PdfReader(str(pdf_path))
    pages_text: List[str] = []
    for page in reader.pages:
        txt = page.extract_text() or ""
        txt = re.sub(r"[ \t]+", " ", txt).strip()
        pages_text.append(txt)
    return pages_text


def chunk_text(text: str, chunk_size: int = 900, overlap: int = 150) -> List[str]:
    text = text.strip()
    if not text:
        return []
    chunks = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + chunk_size, n)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == n:
            break
        start = max(end - overlap, start + 1)
    return chunks


def embed_texts(texts: List[str]) -> List[List[float]]:
    resp = openai_client.embeddings.create(
        model=EMBEDDINGS_MODEL,
        input=texts,
    )
    return [d.embedding for d in resp.data]


def qdrant_collection_exists(name: str) -> bool:
    r = requests.get(f"{QDRANT_URL}/collections/{name}", headers=QDRANT_HEADERS, timeout=20)
    return r.status_code == 200


def qdrant_create_collection(name: str, vector_size: int, distance: str = "Cosine") -> None:
    payload = {"vectors": {"size": vector_size, "distance": distance}}
    r = requests.put(
        f"{QDRANT_URL}/collections/{name}",
        headers=QDRANT_HEADERS,
        json=payload,
        timeout=30,
    )
    r.raise_for_status()


def qdrant_recreate_collection(name: str, vector_size: int) -> None:
    if qdrant_collection_exists(name):
        requests.delete(f"{QDRANT_URL}/collections/{name}", headers=QDRANT_HEADERS, timeout=30)
    qdrant_create_collection(name, vector_size=vector_size, distance="Cosine")


def qdrant_upsert_points(collection: str, points: List[Dict[str, Any]]) -> None:
    payload = {"points": points}
    r = requests.put(
        f"{QDRANT_URL}/collections/{collection}/points?wait=true",
        headers=QDRANT_HEADERS,
        json=payload,
        timeout=120,
    )
    r.raise_for_status()


def qdrant_search(collection: str, vector: List[float], limit: int = 5) -> List[Dict[str, Any]]:
    payload = {"vector": vector, "limit": limit, "with_payload": True, "with_vector": False}
    r = requests.post(
        f"{QDRANT_URL}/collections/{collection}/points/search",
        headers=QDRANT_HEADERS,
        json=payload,
        timeout=30,
    )
    r.raise_for_status()
    return r.json().get("result", [])


# ---------------------------
# Schemas
# ---------------------------

class ChatRequest(BaseModel):
    q: str
    top_k: int = 5
    min_score: float = 0.35
    max_context_chars: int = 12000


# ---------------------------
# Routes
# ---------------------------

@app.get("/")
def root():
    return {"status": "ok", "service": "siftops"}


@app.get("/documents")
def documents():
    return {"status": "ok", "documents": list_pdfs_by_sector()}


@app.post("/reindex")
def reindex():
    try:
        docs = list_pdfs_by_sector()
        if not docs:
            return {"status": "ok", "documents_indexed": 0, "collection": QDRANT_COLLECTION, "note": "No PDFs found."}

        probe_vec = embed_texts(["probe"])[0]
        vector_size = len(probe_vec)

        qdrant_recreate_collection(QDRANT_COLLECTION, vector_size=vector_size)

        documents_indexed = 0

        for sector, files in docs.items():
            for filename in files:
                pdf_path = DATA_DIR / sector / filename
                if not pdf_path.exists():
                    continue

                pages = extract_pdf_pages(pdf_path)
                if not any(p.strip() for p in pages):
                    continue

                chunks_to_embed: List[str] = []
                chunk_payloads: List[Dict[str, Any]] = []

                for page_i, page_text in enumerate(pages, start=1):
                    if not page_text.strip():
                        continue
                    for chunk_i, chunk in enumerate(chunk_text(page_text), start=1):
                        chunk_id = f"{pdf_path.stem}-p{page_i}-c{chunk_i}"
                        chunks_to_embed.append(chunk)
                        chunk_payloads.append({
                            "doc": filename,
                            "sector": sector,
                            "page": page_i,
                            "chunk_id": chunk_id,
                            "text": chunk,
                        })

                if not chunks_to_embed:
                    continue

                BATCH = 64
                for i in range(0, len(chunks_to_embed), BATCH):
                    batch_texts = chunks_to_embed[i:i+BATCH]
                    batch_payloads = chunk_payloads[i:i+BATCH]
                    batch_vectors = embed_texts(batch_texts)

                    batch_points = []
                    for vec, payload in zip(batch_vectors, batch_payloads):
                        batch_points.append({
                            "id": str(uuid.uuid4()),
                            "vector": vec,
                            "payload": payload,
                        })

                    qdrant_upsert_points(QDRANT_COLLECTION, batch_points)

                documents_indexed += 1

        return {"status": "ok", "documents_indexed": documents_indexed, "collection": QDRANT_COLLECTION}

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/search")
def search(q: str = Query(..., min_length=1), limit: int = TOP_K_DEFAULT):
    try:
        qvec = embed_texts([q])[0]
        hits = qdrant_search(QDRANT_COLLECTION, qvec, limit=limit)

        results = []
        for h in hits:
            payload = h.get("payload") or {}
            results.append({
                "score": h.get("score", 0.0),
                "doc": payload.get("doc"),
                "sector": payload.get("sector"),
                "page": payload.get("page"),
                "chunk_id": payload.get("chunk_id"),
                "text": payload.get("text"),
            })

        return {"status": "ok", "query": q, "results": results}

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/chat")
def chat(req: ChatRequest):
    q = (req.q or "").strip()
    if not q:
        return {"status": "error", "error": "Please provide a question."}

    # 1) retrieve
    qvec = embed_texts([q])[0]
    hits = qdrant_search(QDRANT_COLLECTION, qvec, limit=req.top_k)

    results = []
    for h in hits:
        payload = h.get("payload") or {}
        results.append({
            "score": h.get("score", 0.0),
            "doc": payload.get("doc"),
            "sector": payload.get("sector"),
            "page": payload.get("page"),
            "chunk_id": payload.get("chunk_id"),
            "text": payload.get("text"),
        })

    best = max([r["score"] for r in results], default=0.0)
    if not results or best < req.min_score:
        return {
            "status": "ok",
            "query": q,
            "answer": "I can't answer from the indexed documents (not enough evidence).",
            "citations": [],
            "used_chunks": 0,
        }

    # 2) context + citations
    citations = []
    context_parts = []
    total_chars = 0

    for r in results[: req.top_k]:
        txt = (r["text"] or "").strip()
        if not txt:
            continue

        citations.append({
            "doc": r["doc"],
            "sector": r["sector"],
            "page": r["page"],
            "chunk_id": r["chunk_id"],
            "score": r["score"],
        })

        block = f"[SOURCE] {r['doc']} (page {r['page']})\n{txt}\n"
        if total_chars + len(block) > req.max_context_chars:
            break
        context_parts.append(block)
        total_chars += len(block)

    context = "\n---\n".join(context_parts)

    # 3) generate (strict grounding)
    system = (
        "You are SiftOps, a strict internal policy assistant.\n"
        "Rules:\n"
        "- Use ONLY the provided SOURCES.\n"
        "- If the answer is not explicitly supported by SOURCES, refuse.\n"
        "- Keep the answer short.\n"
        "- Add citations like (DocName, page).\n"
        "- No hallucination.\n"
    )

    user = f"Question:\n{q}\n\nSOURCES:\n{context}\n\nAnswer with citations."

    resp = openai_client.chat.completions.create(
        model=CHAT_MODEL,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0,
    )

    answer = resp.choices[0].message.content.strip()

    return {
        "status": "ok",
        "query": q,
        "answer": answer,
        "citations": citations,
        "used_chunks": len(context_parts),
    }


# Optional: run directly
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("backend.app:app", host="0.0.0.0", port=port, reload=True)
