import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  description?: string;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: SelectOption[];
  groups?: SelectGroup[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function Select({
  value,
  onChange,
  options,
  groups,
  placeholder = "Select...",
  className = "",
  disabled = false,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const flatOptions: SelectOption[] = groups
    ? groups.flatMap((g) => g.options)
    : options ?? [];

  const selectedOption = flatOptions.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      const idx = flatOptions.findIndex((o) => o.value === value);
      setHighlightIdx(idx >= 0 ? idx : 0);
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIdx((i) => Math.min(i + 1, flatOptions.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIdx((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (highlightIdx >= 0 && highlightIdx < flatOptions.length) {
            onChange(flatOptions[highlightIdx].value);
            setOpen(false);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [open, highlightIdx, flatOptions, onChange]
  );

  useEffect(() => {
    if (open && highlightIdx >= 0 && listRef.current) {
      const el = listRef.current.querySelector(`[data-idx="${highlightIdx}"]`);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx, open]);

  let optIdx = -1;

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm text-text transition-colors ${
          open ? "border-primary ring-1 ring-primary/20" : "border-border"
        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-primary/50"} bg-bg-surface`}
      >
        <span className={`truncate ${!selectedOption ? "text-text-muted" : ""}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-bg-surface py-1 shadow-lg shadow-black/20 animate-in fade-in slide-in-from-top-1"
          style={{ animationDuration: "120ms" }}
        >
          {groups ? (
            groups.map((group) => (
              <div key={group.label}>
                <div className="sticky top-0 z-10 bg-bg-elevated px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {group.label}
                </div>
                {group.options.map((opt) => {
                  optIdx++;
                  const idx = optIdx;
                  const isActive = opt.value === value;
                  const isHighlight = idx === highlightIdx;
                  return (
                    <button
                      key={opt.value}
                      data-idx={idx}
                      type="button"
                      onMouseEnter={() => setHighlightIdx(idx)}
                      onClick={() => { onChange(opt.value); setOpen(false); }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        isHighlight ? "bg-primary/10" : ""
                      } ${isActive ? "text-primary font-medium" : "text-text"}`}
                    >
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <span className="flex-1 truncate">{opt.label}</span>
                      {opt.description && (
                        <span className="text-[11px] text-text-muted">{opt.description}</span>
                      )}
                      {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            flatOptions.map((opt) => {
              optIdx++;
              const idx = optIdx;
              const isActive = opt.value === value;
              const isHighlight = idx === highlightIdx;
              return (
                <button
                  key={opt.value}
                  data-idx={idx}
                  type="button"
                  onMouseEnter={() => setHighlightIdx(idx)}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    isHighlight ? "bg-primary/10" : ""
                  } ${isActive ? "text-primary font-medium" : "text-text"}`}
                >
                  {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                  <span className="flex-1 truncate">{opt.label}</span>
                  {opt.description && (
                    <span className="text-[11px] text-text-muted">{opt.description}</span>
                  )}
                  {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
