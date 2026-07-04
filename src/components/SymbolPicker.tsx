import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, Plus, X, Star } from "lucide-react";
import { instrumentCategories, type InstrumentCategory } from "@/data/instruments";
import { useSettings } from "@/store/useSettings";

interface SymbolPickerProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  className?: string;
  includeCustom?: boolean;
}

export default function SymbolPicker({
  value,
  onChange,
  language,
  className = "",
  includeCustom = true,
}: SymbolPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const customSymbols = useSettings((s) => s.customSymbols);
  const addCustomSymbol = useSettings((s) => s.addCustomSymbol);
  const removeCustomSymbol = useSettings((s) => s.removeCustomSymbol);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setAdding(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups: { label: string; items: { symbol: string; label: string; isCustom?: boolean }[] }[] = [];

    for (const cat of instrumentCategories) {
      const catLabel = language === "zh" ? cat.labelZh : cat.label;
      const items = cat.instruments
        .filter((inst) => !q || inst.symbol.toLowerCase().includes(q) || inst.label.toLowerCase().includes(q) || inst.labelZh.includes(q))
        .map((inst) => ({
          symbol: inst.symbol,
          label: language === "zh" ? inst.labelZh : inst.label,
        }));
      if (items.length > 0) groups.push({ label: catLabel, items });
    }

    if (includeCustom && customSymbols.length > 0) {
      const customLabel = language === "zh" ? "自定义" : "Custom";
      const items = customSymbols
        .filter((cs) => !q || cs.toLowerCase().includes(q))
        .map((cs) => ({ symbol: cs, label: cs, isCustom: true }));
      if (items.length > 0) groups.push({ label: customLabel, items });
    }

    return groups;
  }, [query, language, customSymbols, includeCustom]);

  const allSymbols = filteredGroups.flatMap((g) => g.items);
  const selectedLabel = useMemo(() => {
    for (const cat of instrumentCategories) {
      const inst = cat.instruments.find((i) => i.symbol === value);
      if (inst) return language === "zh" ? inst.labelZh : inst.label;
    }
    if (customSymbols.includes(value)) return value;
    return value;
  }, [value, language, customSymbols]);

  const showAddCustom = includeCustom && query.trim() && !allSymbols.some((s) => s.symbol === query.trim().toUpperCase());

  function handleAddCustom() {
    const sym = (newSymbol || query).trim().toUpperCase();
    if (!sym) return;
    addCustomSymbol(sym);
    onChange(sym);
    setOpen(false);
    setQuery("");
    setNewSymbol("");
    setAdding(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm text-text transition-colors ${
          open ? "border-primary ring-1 ring-primary/20" : "border-border"
        } cursor-pointer hover:border-primary/50 bg-bg-surface`}
      >
        <span className={`truncate ${!value ? "text-text-muted" : ""}`}>
          {value ? selectedLabel : language === "zh" ? "选择品种" : "Select symbol"}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[260px] overflow-hidden rounded-md border border-border bg-bg-surface shadow-lg shadow-black/20">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={language === "zh" ? "搜索品种..." : "Search symbols..."}
              className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
              onKeyDown={(e) => {
                if (e.key === "Enter" && showAddCustom) {
                  e.preventDefault();
                  handleAddCustom();
                }
                if (e.key === "Escape") {
                  setOpen(false);
                  setQuery("");
                }
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-text-muted hover:text-text"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-auto py-1">
            {allSymbols.length === 0 && !showAddCustom ? (
              <div className="px-3 py-4 text-center text-xs text-text-muted">
                {language === "zh" ? "未找到品种" : "No symbols found"}
              </div>
            ) : (
              <>
                {filteredGroups.map((group) => (
                  <div key={group.label}>
                    <div className="sticky top-0 z-10 bg-bg-elevated px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      {group.label}
                    </div>
                    {group.items.map((item) => {
                      const isActive = item.symbol === value;
                      return (
                        <button
                          key={item.symbol}
                          type="button"
                          onClick={() => { onChange(item.symbol); setOpen(false); setQuery(""); }}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10 ${
                            isActive ? "bg-primary/10 text-primary font-medium" : "text-text"
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          <div className="flex items-center gap-1.5">
                            {item.isCustom && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeCustomSymbol(item.symbol);
                                  if (value === item.symbol) onChange("");
                                }}
                                className="rounded p-0.5 text-text-muted hover:bg-loss/10 hover:text-loss"
                                title={language === "zh" ? "删除自定义品种" : "Remove custom symbol"}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                            {isActive && <Star className="h-3 w-3 shrink-0 text-primary" fill="currentColor" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
                {showAddCustom && (
                  <div className="border-t border-border mt-1 pt-1">
                    {adding ? (
                      <div className="flex items-center gap-2 px-3 py-2">
                        <input
                          type="text"
                          value={newSymbol}
                          onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                          placeholder={language === "zh" ? "输入品种代码" : "Enter symbol"}
                          className="flex-1 rounded border border-border bg-bg-elevated px-2 py-1 text-sm text-text outline-none focus:border-primary"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddCustom();
                            if (e.key === "Escape") { setAdding(false); setNewSymbol(""); }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleAddCustom}
                          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
                        >
                          {language === "zh" ? "添加" : "Add"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setAdding(true); setNewSymbol(query.trim().toUpperCase()); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
                      >
                        <Plus className="h-4 w-4" />
                        <span>
                          {language === "zh"
                            ? `添加「${query.trim().toUpperCase()}」为自定义品种`
                            : `Add "${query.trim().toUpperCase()}" as custom symbol`}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
