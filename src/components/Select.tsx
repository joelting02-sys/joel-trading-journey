import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption { value: string; label: string; icon?: ReactNode; description?: string; }
export interface SelectGroup { label: string; options: SelectOption[]; }
interface SelectProps { value: string; onChange: (value: string) => void; options?: SelectOption[]; groups?: SelectGroup[]; placeholder?: string; className?: string; disabled?: boolean; }

export default function Select({ value, onChange, options, groups, placeholder = "Select...", className = "", disabled = false }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const flatOptions: SelectOption[] = groups ? groups.flatMap((g) => g.options) : options ?? [];
  const selectedOption = flatOptions.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);
  useEffect(() => { if (open) { const idx = flatOptions.findIndex((o) => o.value === value); setHighlightIdx(idx >= 0 ? idx : 0); } }, [open, value]);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) { if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); setOpen(true); } return; }
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, flatOptions.length - 1)); break;
      case "ArrowUp": e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, 0)); break;
      case "Enter": case " ": e.preventDefault(); if (highlightIdx >= 0 && highlightIdx < flatOptions.length) { onChange(flatOptions[highlightIdx].value); setOpen(false); } break;
      case "Escape": e.preventDefault(); setOpen(false); break;
    }
  }, [open, highlightIdx, flatOptions, onChange]);
  useEffect(() => { if (open && highlightIdx >= 0 && listRef.current) listRef.current.querySelector(`[data-idx="${highlightIdx}"]`)?.scrollIntoView({ block: "nearest" }); }, [highlightIdx, open]);

  let optIdx = -1;
  const renderOption = (opt: SelectOption) => {
    optIdx++; const idx = optIdx; const isActive = opt.value === value; const isHighlight = idx === highlightIdx;
    return <button key={opt.value} data-idx={idx} type="button" onMouseEnter={() => setHighlightIdx(idx)} onClick={() => { onChange(opt.value); setOpen(false); }} className={`tj-select-option flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${isHighlight ? "is-highlight" : ""} ${isActive ? "is-active" : ""}`}>
      {opt.icon && <span className="shrink-0">{opt.icon}</span>}<span className="flex-1 truncate">{opt.label}</span>{opt.description && <span className="text-[11px] text-text-muted">{opt.description}</span>}{isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
    </button>;
  };

  return <div ref={containerRef} className={`tj-select relative ${className}`} onKeyDown={handleKeyDown}>
    <button type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} className={`tj-select-trigger flex w-full items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm text-text ${open ? "is-open" : ""} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
      <span className={`truncate ${!selectedOption ? "text-text-muted" : ""}`}>{selectedOption ? selectedOption.label : placeholder}</span><ChevronDown className={`h-4 w-4 shrink-0 text-text-muted ${open ? "is-open" : ""}`} />
    </button>
    {open && <div ref={listRef} role="listbox" className="tj-select-menu absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border py-1">{groups ? groups.map((group) => <div key={group.label}><div className="tj-select-group sticky top-0 z-10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider">{group.label}</div>{group.options.map(renderOption)}</div>) : flatOptions.map(renderOption)}</div>}
  </div>;
}
