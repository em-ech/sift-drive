"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Copy,
  Check,
  FileText,
  User,
  MessageSquare,
} from "lucide-react";

interface Citation {
  doc: string;
  sector: string;
  page: number;
  chunk_id: string;
  score: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

interface Props {
  apiUrl: string;
}

function renderMarkdown(text: string): React.ReactNode[] {
  // Split by **bold** markers and render
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function AssistantTab({ apiUrl }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuery("");
    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, top_k: 5 }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "No answer available.",
          citations: data.citations || [],
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto pr-1">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <MessageSquare
              size={48}
              strokeWidth={1}
              className="mb-3 opacity-40"
            />
            <p className="text-sm">Ask a question about internal policies</p>
          </div>
        )}

        <div className="space-y-5 pb-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {/* Assistant avatar */}
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-1">
                  <FileText size={14} className="text-slate-500" />
                </div>
              )}

              {/* Message content */}
              <div
                className={`max-w-[80%] ${
                  msg.role === "user" ? "" : ""
                }`}
              >
                {msg.role === "user" ? (
                  <div className="bg-slate-800 text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed">
                    {msg.content}
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-5 py-4">
                    {/* Copy button */}
                    <button
                      onClick={() => copyToClipboard(msg.content, i)}
                      className="text-slate-400 hover:text-slate-600 mb-2 transition-colors"
                      title="Copy to clipboard"
                    >
                      {copiedIdx === i ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>

                    {/* Answer text */}
                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {renderMarkdown(msg.content)}
                    </div>

                    {/* Citations */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <p className="text-xs font-medium text-slate-500 mb-2">
                          Sources
                        </p>
                        <div className="space-y-1.5">
                          {msg.citations.map((c, ci) => (
                            <div
                              key={ci}
                              className="flex items-center gap-2 text-xs text-slate-500"
                            >
                              <span className="text-slate-400 font-medium">
                                [{ci + 1}]
                              </span>
                              <FileText
                                size={12}
                                className="text-slate-400 shrink-0"
                              />
                              <span className="truncate">{c.doc}</span>
                              <span className="text-slate-300 shrink-0">
                                p. {c.page}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User avatar */}
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 mt-1">
                  <User size={14} className="text-white" />
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                <FileText size={14} className="text-slate-500" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-5 py-4">
                <div className="flex gap-1.5">
                  <span
                    className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSend}
        className="flex gap-3 pt-4 pb-2 border-t border-slate-200 shrink-0"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white placeholder:text-slate-400"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-4 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
