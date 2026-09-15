"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  Save,
  RefreshCw,
  Pencil,
  Trash2,
  Check,
  X,
  FileCode2,
  Copy,
  Search,
  Download,
  Upload,
  FilePlus2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProblemSummary } from "@/lib/api";
import { relativeTime } from "@/lib/storage";

/**
 * Problems sidebar: save the current workspace, filter and list saved
 * problems, load / rename / duplicate / delete them, export the whole library
 * as JSON and import a bundle back. Each problem persists its source, tests,
 * stdin, stress sources and settings via /api/problems.
 */
export function ProblemsSidebar({
  problems,
  activeSlug,
  dirty,
  saveName,
  onSaveNameChange,
  onSave,
  onLoad,
  onRename,
  onDuplicate,
  onDelete,
  onRefresh,
  onNew,
  onExport,
  onImport,
  busy,
}: {
  problems: ProblemSummary[];
  activeSlug: string | null;
  /** True when the workspace differs from the last saved/loaded state. */
  dirty: boolean;
  saveName: string;
  onSaveNameChange: (value: string) => void;
  onSave: () => void;
  onLoad: (slug: string) => void;
  onRename: (slug: string, to: string) => void;
  onDuplicate: (slug: string, to: string) => void;
  onDelete: (slug: string) => void;
  onRefresh: () => void;
  onNew: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  busy: boolean;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [nameValue, setNameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return problems;
    return problems.filter(
      (p) => p.name.toLowerCase().includes(q) || p.slug.includes(q),
    );
  }, [problems, filter]);

  const startRename = (p: ProblemSummary) => {
    setRenaming(p.slug);
    setDuplicating(null);
    setNameValue(p.name);
    setConfirmDelete(null);
  };

  const startDuplicate = (p: ProblemSummary) => {
    setDuplicating(p.slug);
    setRenaming(null);
    setNameValue(`${p.name} copy`);
    setConfirmDelete(null);
  };

  const submitName = (slug: string) => {
    const to = nameValue.trim();
    if (to) {
      if (renaming === slug) onRename(slug, to);
      else if (duplicating === slug) onDuplicate(slug, to);
    }
    setRenaming(null);
    setDuplicating(null);
  };

  return (
    <div
      className="flex h-full w-full min-w-0 flex-col overflow-hidden"
      data-testid="problems-sidebar"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
          Problems
          {problems.length > 0 ? (
            <span className="ml-1.5 font-mono text-[10px] text-zinc-600">
              {problems.length}
            </span>
          ) : null}
        </span>
        <div className="flex items-center gap-0.5">
          <IconButton
            label="New workspace"
            testId="new-workspace-button"
            onClick={onNew}
          >
            <FilePlus2 className="h-3.5 w-3.5 text-zinc-500" />
          </IconButton>
          <IconButton
            label="Export all problems as JSON"
            testId="export-problems-button"
            onClick={onExport}
          >
            <Download className="h-3.5 w-3.5 text-zinc-500" />
          </IconButton>
          <IconButton
            label="Import problems from JSON"
            testId="import-problems-button"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5 text-zinc-500" />
          </IconButton>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="import-problems-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = "";
            }}
          />
          <IconButton
            label="Refresh problems list"
            testId="refresh-problems-button"
            onClick={onRefresh}
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5 text-zinc-500",
                busy && "animate-spin",
              )}
            />
          </IconButton>
        </div>
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
          {dirty && activeSlug ? (
            <span
              className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber-500"
              title="Unsaved changes"
              data-testid="dirty-indicator"
            />
          ) : null}
        </button>
      </form>

      {problems.length > 3 ? (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-zinc-800 px-3 py-1.5">
          <Search className="h-3 w-3 text-zinc-600" />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            aria-label="Filter problems"
            data-testid="filter-problems"
            className="w-full bg-transparent text-xs text-zinc-300 outline-none placeholder:text-zinc-600"
          />
        </div>
      ) : null}

      <ul
        className="min-h-0 flex-1 overflow-y-auto py-1"
        data-testid="problems-list"
      >
        {visible.length === 0 ? (
          <li className="px-3 py-6 text-center text-[11px] text-zinc-600">
            {problems.length === 0
              ? "No saved problems yet."
              : "No problems match the filter."}
          </li>
        ) : (
          visible.map((p) => {
            const isActive = p.slug === activeSlug;
            const isEditing = renaming === p.slug || duplicating === p.slug;
            return (
              <li
                key={p.slug}
                data-testid={`problem-item-${p.slug}`}
                className={cn(
                  "group flex items-center gap-1 px-2 py-1",
                  isActive && "bg-zinc-800/40",
                )}
              >
                {isEditing ? (
                  <div className="flex w-full items-center gap-1">
                    <input
                      autoFocus
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitName(p.slug);
                        if (e.key === "Escape") {
                          setRenaming(null);
                          setDuplicating(null);
                        }
                      }}
                      aria-label={
                        renaming ? `Rename ${p.name}` : `Duplicate ${p.name} as`
                      }
                      className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500"
                    />
                    <IconButton
                      label={renaming ? "Confirm rename" : "Confirm duplicate"}
                      testId={`confirm-name-${p.slug}`}
                      onClick={() => submitName(p.slug)}
                    >
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    </IconButton>
                    <IconButton
                      label="Cancel"
                      onClick={() => {
                        setRenaming(null);
                        setDuplicating(null);
                      }}
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
                      title={`Updated ${relativeTime(p.updatedAt)}`}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1 text-left"
                    >
                      <FileCode2
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          isActive ? "text-emerald-400" : "text-zinc-600",
                        )}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
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
                        <span className="truncate font-mono text-[9px] text-zinc-600">
                          {p.testCount} test{p.testCount === 1 ? "" : "s"} ·{" "}
                          {relativeTime(p.updatedAt)}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                      <IconButton
                        label={`Rename ${p.name}`}
                        testId={`rename-problem-${p.slug}`}
                        onClick={() => startRename(p)}
                      >
                        <Pencil className="h-3 w-3 text-zinc-500" />
                      </IconButton>
                      <IconButton
                        label={`Duplicate ${p.name}`}
                        testId={`duplicate-problem-${p.slug}`}
                        onClick={() => startDuplicate(p)}
                      >
                        <Copy className="h-3 w-3 text-zinc-500" />
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
