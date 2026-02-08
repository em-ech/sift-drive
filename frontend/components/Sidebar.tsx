"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Users,
  DollarSign,
  Scale,
  Shield,
  Code,
  RefreshCw,
  FolderOpen,
  type LucideIcon,
} from "lucide-react";

const SECTORS: Record<
  string,
  { label: string; icon: LucideIcon; order: number }
> = {
  HR: { label: "HR", icon: Users, order: 0 },
  finance: { label: "Finance", icon: DollarSign, order: 1 },
  legal_compliance: { label: "Legal", icon: Scale, order: 2 },
  security_it: { label: "Security / IT", icon: Shield, order: 3 },
  product_en_support: { label: "Product", icon: Code, order: 4 },
};

function pseudoSize(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++)
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return (1.8 + (Math.abs(h) % 15) / 10).toFixed(1) + " KB";
}

interface Props {
  documents: Record<string, string[]>;
  totalDocs: number;
  onRefresh: () => void;
  onReindex: () => void;
  reindexing: boolean;
}

export default function Sidebar({
  documents,
  totalDocs,
  onRefresh,
  onReindex,
  reindexing,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (sector: string) => {
    setExpanded((prev) => ({ ...prev, [sector]: !prev[sector] }));
  };

  const sortedSectors = Object.keys(documents).sort(
    (a, b) => (SECTORS[a]?.order ?? 99) - (SECTORS[b]?.order ?? 99)
  );

  return (
    <aside className="w-[280px] bg-white border-r border-slate-200 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 pt-6 pb-2">
        <h1 className="text-xl font-bold text-slate-900">SiftOps</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Internal Knowledge Base
        </p>
      </div>

      {/* Documents header */}
      <div className="px-5 pt-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen size={18} className="text-slate-600" />
          <span className="text-base font-semibold text-slate-800">
            Documents
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-sm text-slate-500 border border-slate-200 rounded-full px-3 py-1 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <p className="px-5 text-sm text-slate-400 mt-2 mb-3">
        {totalDocs} documents uploaded
      </p>

      {/* Sector list */}
      <div className="flex-1 overflow-y-auto">
        {sortedSectors.map((sector) => {
          const config = SECTORS[sector] || {
            label: sector,
            icon: FileText,
            order: 99,
          };
          const Icon = config.icon;
          const files = documents[sector] || [];
          const isOpen = expanded[sector] || false;

          return (
            <div key={sector}>
              <button
                onClick={() => toggle(sector)}
                className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors ${
                  isOpen
                    ? "bg-blue-50/60 border-l-[3px] border-l-blue-600"
                    : "border-l-[3px] border-l-transparent"
                }`}
              >
                {isOpen ? (
                  <ChevronDown size={16} className="text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight size={16} className="text-slate-400 shrink-0" />
                )}
                <Icon size={18} className="text-slate-500 shrink-0" />
                <span className="flex-1 text-left text-sm font-medium text-slate-700">
                  {config.label}
                </span>
                <span className="w-7 h-7 rounded-full bg-slate-800 text-white text-xs flex items-center justify-center font-medium shrink-0">
                  {files.length}
                </span>
              </button>

              {isOpen && (
                <div className="pb-1">
                  {files.map((file) => (
                    <div
                      key={file}
                      className="flex items-center gap-2.5 px-5 pl-[3.5rem] py-2 text-sm text-slate-600"
                    >
                      <FileText
                        size={15}
                        className="text-slate-400 shrink-0"
                      />
                      <span className="truncate flex-1" title={file}>
                        {file.replace(".pdf", "")}
                      </span>
                      <span className="text-xs text-slate-400 shrink-0 tabular-nums">
                        {pseudoSize(file)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reindex button */}
      <div className="p-4">
        <button
          onClick={onReindex}
          disabled={reindexing}
          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {reindexing ? "Reindexing..." : "Reindex Documents"}
        </button>
      </div>
    </aside>
  );
}
