"use client";

import { useState } from "react";
import { Search, ChevronDown, ChevronUp, FileText } from "lucide-react";

interface SearchResult {
  score: number;
  doc: string;
  sector: string;
  page: number;
  chunk_id: string;
  text: string;
}

interface Props {
  apiUrl: string;
}

function matchColor(score: number): string {
  const pct = Math.round(score * 100);
  if (pct >= 50) return "text-green-500";
  if (pct >= 35) return "text-amber-500";
  return "text-slate-400";
}

function formatSector(sector: string): string {
  const map: Record<string, string> = {
    HR: "Hr",
    finance: "Finance",
    legal_compliance: "Legal",
    security_it: "Security",
    product_en_support: "Product",
  };
  return map[sector] || sector;
}

export default function SearchTab({ apiUrl }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    setExpandedIdx(null);
    try {
      const res = await fetch(
        `${apiUrl}/search?q=${encodeURIComponent(query.trim())}&limit=5`
      );
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-4 shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search policies and documents..."
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          <Search size={18} />
        </button>
      </form>

      {/* Results count */}
      {searched && !loading && (
        <p className="text-sm text-slate-400 mb-4 shrink-0">
          {results.length} results for &ldquo;{query}&rdquo;
        </p>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Searching...</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!searched && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <Search size={48} strokeWidth={1} className="mb-3 opacity-40" />
          <p className="text-sm">Enter a search query to find documents</p>
        </div>
      )}

      {/* Results list */}
      {searched && !loading && (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {results.map((r, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              <button
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <FileText size={20} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {r.doc}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatSector(r.sector)} &middot; Page {r.page} &middot;{" "}
                    <span className={`font-medium ${matchColor(r.score)}`}>
                      {Math.round(r.score * 100)}% match
                    </span>
                  </p>
                </div>
                {expandedIdx === i ? (
                  <ChevronUp size={18} className="text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown size={18} className="text-slate-400 shrink-0" />
                )}
              </button>

              {expandedIdx === i && (
                <div className="px-5 pb-4">
                  <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {r.text}
                  </div>
                </div>
              )}
            </div>
          ))}

          {results.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">
              No results found. Try a different query.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
