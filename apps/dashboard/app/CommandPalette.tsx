'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type Command = {
  id: string;
  label: string;
  /** grouping hint shown on the right, e.g. "Go to" or "Machine" */
  where: string;
  run: () => void;
};

/**
 * ⌘K / Ctrl+K jump-to. Pages and every machine by serial are targets, so an
 * operator can reach a specific unit without walking the fleet table.
 */
export function CommandPalette({ commands }: { commands: Command[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 8);
    return commands.filter((c) => `${c.label} ${c.where}`.toLowerCase().includes(q)).slice(0, 8);
  }, [commands, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setCursor(0);
  }, []);

  // global open/close shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === 'Escape' && open) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  if (!open) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => (results.length ? (c + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = results[cursor];
      if (pick) {
        pick.run();
        close();
      }
    }
  }

  return (
    <div
      className="cmdk-scrim"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          ref={inputRef}
          value={query}
          placeholder="Jump to a page or a machine…"
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          aria-label="Search commands"
        />
        {results.length === 0 ? (
          <div className="cmdk-empty">Nothing matches “{query}”.</div>
        ) : (
          <ul role="listbox">
            {results.map((c, i) => (
              <li
                key={c.id}
                role="option"
                aria-selected={i === cursor}
                onMouseEnter={() => setCursor(i)}
                onClick={() => {
                  c.run();
                  close();
                }}
              >
                <span>{c.label}</span>
                <span className="where">{c.where}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
