"use client";

import { useState, type ReactNode } from "react";
import {
  Save,
  RefreshCw,
  Pencil,
  Trash2,
  Check,
  X,
  FileCode2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProblemSummary } from "@/lib/api";

/**
 * Problems sidebar: save the current workspace, list saved problems and load,
 * rename or delete them (each persisted with its test cases via /api/problems).
 */
export function ProblemsSidebar({
  problems,
  activeSlug,
  saveName,
  onSaveNameChange,
  onSave,
  onLoad,
  onRename,
  onDelete,
  onRefresh,
  busy,
}: {
  problems: ProblemSummary[];
  activeSlug: string | null;
  saveName: string;
  onSaveNameChange: (value: string) => void;
  onSave: () => void;
  onLoad: (slug: string) => void;
  onRename: (slug: string, to: string) => void;
  onDelete: (slug: string) => void;
  onRefresh: () => void;
  busy: boolean;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const startRename = (p: ProblemSummary) => {
    setRenaming(p.slug);
    setRenameValue(p.name);
    setConfirmDelete(null);
  };

  const submitRename = (slug: string) => {
    const to = renameValue.trim();
    if (to) onRename(slug, to);
    setRenaming(null);
  };

  return (
    <div className="flex h-full flex-col" data-testid="problems-sidebar">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
          Problems
        </span>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh problems list"
          data-testid="refresh-problems-button"
          className="rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
        </button>
      </div>

      <form
        className="flex shrink-0 flex-col gap-2 border-b border-zinc-800 bg-zinc-900/30 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <input
          type="text"
          value={saveName}
          onChange={(e) => onSaveNameChange(e.target.value)}
          placeholder="Problem name (e.g. 1620C)"
          data-testid="save-problem-name"
          aria-label="Problem name to save"
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-600"
        />
        <button
          type="submit"
          disabled={!saveName.trim()}
          data-testid="save-problem-button"
          aria-label="Save current workspace"
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-zinc-200 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" />
          Save workspace
        </button>
      </form>

      <ul
        className="min-h-0 flex-1 overflow-y-auto py-1"
        data-testid="problems-list"
      >
        {problems.length === 0 ? (
          <li className="px-3 py-6 text-center text-[11px] text-zinc-600">
            No saved problems yet.
          </li>
        ) : (
          problems.map((p) => {
            const isActive = p.slug === activeSlug;
            const isRenaming = renaming === p.slug;
            return (
              <li
                key={p.slug}
                data-testid={`problem-item-${p.slug}`}
                className={cn(
                  "group flex items-center gap-1 px-2 py-1",
                  isActive && "bg-zinc-800/40",
                )}
              >
                {isRenaming ? (
                  <div className="flex w-full items-center gap-1">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitRename(p.slug);
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      aria-label={`Rename ${p.name}`}
                      className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500"
                    />
                    <IconButton
                      label="Confirm rename"
                      onClick={() => submitRename(p.slug)}
                    >
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    </IconButton>
                    <IconButton
                      label="Cancel rename"
                      onClick={() => setRenaming(null)}
                    >
                      <X className="h-3.5 w-3.5 text-zinc-400" />
                    </IconButton>
                  </div>
                ) : confirmDelete === p.slug ? (
                  <div className="flex w-full items-center gap-2 px-1">
                    <span className="flex-1 truncate text-[11px] text-red-300">
                      Delete {p.name}?
                    </span>
                    <IconButton
                      label="Confirm delete"
                      testId={`confirm-delete-${p.slug}`}
                      onClick={() => {
                        onDelete(p.slug);
                        setConfirmDelete(null);
                      }}
                    >
                      <Check className="h-3.5 w-3.5 text-red-400" />
                    </IconButton>
                    <IconButton
                      label="Cancel delete"
                      onClick={() => setConfirmDelete(null)}
                    >
                      <X className="h-3.5 w-3.5 text-zinc-400" />
                    </IconButton>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onLoad(p.slug)}
                      data-testid={`load-problem-${p.slug}`}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1 text-left"
                    >
                      <FileCode2
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          isActive ? "text-emerald-400" : "text-zinc-600",
                        )}
                      />
                      <span
                        className={cn(
                          "truncate text-xs",
                          isActive
                            ? "font-semibold text-zinc-100"
                            : "text-zinc-400",
                        )}
                      >
                        {p.name}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-zinc-600">
                        {p.testCount}t
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
                      <IconButton
                        label={`Rename ${p.name}`}
                        testId={`rename-problem-${p.slug}`}
                        onClick={() => startRename(p)}
                      >
                        <Pencil className="h-3 w-3 text-zinc-500" />
                      </IconButton>
                      <IconButton
                        label={`Delete ${p.name}`}
                        testId={`delete-problem-${p.slug}`}
                        onClick={() => setConfirmDelete(p.slug)}
                      >
                        <Trash2 className="h-3 w-3 text-zinc-500" />
                      </IconButton>
                    </div>
                  </>
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  testId,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-testid={testId}
      className="rounded p-1 transition hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}
