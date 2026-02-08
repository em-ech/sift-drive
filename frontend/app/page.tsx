"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, MessageSquare } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import SearchTab from "@/components/SearchTab";
import AssistantTab from "@/components/AssistantTab";

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://siftops-api-production-1af3.up.railway.app";

export default function Home() {
  const [tab, setTab] = useState<"search" | "assistant">("search");
  const [docs, setDocs] = useState<Record<string, string[]>>({});
  const [total, setTotal] = useState(0);
  const [reindexing, setReindexing] = useState(false);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`${API}/documents`);
      const data = await res.json();
      const d: Record<string, string[]> = data.documents || {};
      setDocs(d);
      setTotal(
        Object.values(d).reduce((sum, files) => sum + files.length, 0)
      );
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleReindex = async () => {
    setReindexing(true);
    try {
      await fetch(`${API}/reindex`, { method: "POST" });
      await fetchDocs();
    } catch {
      /* ignore */
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f0f2f8]">
      {/* Sidebar */}
      <Sidebar
        documents={docs}
        totalDocs={total}
        onRefresh={fetchDocs}
        onReindex={handleReindex}
        reindexing={reindexing}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex justify-end px-8 pt-5 pb-2">
          <span className="text-sm text-slate-400 italic">
            Policy Search &amp; Retrieval System
          </span>
        </header>

        <div className="flex-1 flex flex-col items-center px-8 pt-2 pb-6 overflow-hidden">
          {/* Tab switcher */}
          <div className="flex w-full max-w-3xl bg-white rounded-xl border border-slate-200 overflow-hidden mb-6 shrink-0">
            <button
              onClick={() => setTab("search")}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                tab === "search"
                  ? "text-slate-800 border-slate-700 bg-white"
                  : "text-slate-400 border-transparent hover:text-slate-500"
              }`}
            >
              <Search size={16} />
              Search
            </button>
            <button
              onClick={() => setTab("assistant")}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                tab === "assistant"
                  ? "text-slate-800 border-slate-700 bg-white"
                  : "text-slate-400 border-transparent hover:text-slate-500"
              }`}
            >
              <MessageSquare size={16} />
              Assistant
            </button>
          </div>

          {/* Tab content */}
          <div className="w-full max-w-3xl flex-1 overflow-hidden flex flex-col">
            {tab === "search" ? (
              <SearchTab apiUrl={API} />
            ) : (
              <AssistantTab apiUrl={API} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
