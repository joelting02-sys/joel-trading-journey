import { useMemo, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, X, Target, LogOut, Shield, Brain, GripVertical } from "lucide-react";
import Layout from "@/components/Layout";
import { useSettings } from "@/store/useSettings";
import type { SopRule, SopCategory } from "@/types";

interface CategoryMeta {
  key: SopCategory;
  label: string;
  Icon: typeof Target;
  iconBg: string;
  iconColor: string;
  badge: string;
}

export default function Sop() {
  const t = useSettings((s) => s.t());
  const sopRules = useSettings((s) => s.sopRules);
  const setSopRules = useSettings((s) => s.setSopRules);
  const addSopRule = useSettings((s) => s.addSopRule);
  const updateSopRule = useSettings((s) => s.updateSopRule);
  const deleteSopRule = useSettings((s) => s.deleteSopRule);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SopRule | null>(null);

  const categories: CategoryMeta[] = [
    { key: "entry", label: t.sopPage.entryRules, Icon: Target, iconBg: "bg-primary/12", iconColor: "text-primary", badge: "bg-primary/10 text-primary" },
    { key: "exit", label: t.sopPage.exitRules, Icon: LogOut, iconBg: "bg-info/12", iconColor: "text-info", badge: "bg-info/10 text-info" },
    { key: "risk", label: t.sopPage.riskRules, Icon: Shield, iconBg: "bg-warning/12", iconColor: "text-warning", badge: "bg-warning/10 text-warning" },
    { key: "psychology", label: t.sopPage.psychologyRules, Icon: Brain, iconBg: "bg-loss/12", iconColor: "text-loss", badge: "bg-loss/10 text-loss" },
  ];

  const rulesByCategory = useMemo(() => {
    const map: Record<SopCategory, SopRule[]> = { entry: [], exit: [], risk: [], psychology: [] };
    for (const r of sopRules) map[r.category].push(r);
    return map;
  }, [sopRules]);

  const openAdd = () => { setEditingRule(null); setDialogOpen(true); };
  const openEdit = (rule: SopRule) => { setEditingRule(rule); setDialogOpen(true); };
  const handleDelete = (rule: SopRule) => {
    if (window.confirm(t.sopPage.deleteConfirm)) deleteSopRule(rule.id);
  };
  const handleSave = (data: { category: SopCategory; title: string; description: string }) => {
    if (editingRule) updateSopRule({ ...editingRule, ...data });
    else addSopRule({ id: `sop${Date.now()}`, ...data });
    setDialogOpen(false);
    setEditingRule(null);
  };

  // 拖拽重排:仅替换当前 category 内的顺序,其他 category 规则原位保留
  const handleReorder = (category: SopCategory, reordered: SopRule[]) => {
    const newRules: SopRule[] = [];
    let inserted = false;
    for (const r of sopRules) {
      if (r.category === category) {
        if (!inserted) {
          newRules.push(...reordered);
          inserted = true;
        }
      } else {
        newRules.push(r);
      }
    }
    if (!inserted) newRules.push(...reordered);
    setSopRules(newRules);
  };

  return (
    <Layout title={t.title.sop}>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-bg-surface px-5 py-4">
        <div>
          <h1 className="font-display text-base font-semibold tracking-tight text-text">{t.sopPage.pageHeader}</h1>
          <p className="text-xs text-text-muted">{t.sopPage.pageDesc}</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t.sopPage.addRule}
        </button>
      </div>

      {/* Category sections */}
      <div className="flex flex-col gap-6">
        {categories.map((cat) => (
          <CategorySection
            key={cat.key}
            category={cat}
            rules={rulesByCategory[cat.key]}
            onEdit={openEdit}
            onDelete={handleDelete}
            onReorder={(reordered) => handleReorder(cat.key, reordered)}
          />
        ))}
      </div>

      {dialogOpen && (
        <RuleDialog
          rule={editingRule}
          onClose={() => { setDialogOpen(false); setEditingRule(null); }}
          onSave={handleSave}
        />
      )}
    </Layout>
  );
}

interface CategorySectionProps {
  category: CategoryMeta;
  rules: SopRule[];
  onEdit: (rule: SopRule) => void;
  onDelete: (rule: SopRule) => void;
  onReorder: (reordered: SopRule[]) => void;
}

function CategorySection({ category, rules, onEdit, onDelete, onReorder }: CategorySectionProps) {
  const t = useSettings((s) => s.t());
  const language = useSettings((s) => s.language);
  const { Icon, label, iconBg, iconColor, badge } = category;
  // 拖拽状态:正在拖拽的规则 id、被悬停的规则 id
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragEnter = (id: string) => {
    if (id === dragId) return;
    setOverId(id);
    const from = rules.findIndex((r) => r.id === dragId);
    const to = rules.findIndex((r) => r.id === id);
    if (from < 0 || to < 0) return;
    const next = [...rules];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };
  const handleDragEnd = () => {
    setDragId(null);
    setOverId(null);
  };

  return (
    <section>
      <div className="mb-3 flex items-center gap-2.5">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <h2 className="font-display text-sm font-semibold tracking-tight text-text">{label}</h2>
        <span className={`tj-number inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold ${badge}`}>
          {rules.length}
        </span>
        {rules.length > 1 && (
          <span className="text-[11px] text-text-muted">
            {language === "zh" ? "拖动 ⋮⋮ 调整顺序" : "Drag ⋮⋮ to reorder"}
          </span>
        )}
      </div>

      {rules.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-bg-surface px-4 py-6 text-center text-xs text-text-muted">
          {t.sopPage.noRules}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              isDragging={dragId === rule.id}
              isOver={overId === rule.id && dragId !== rule.id}
              onEdit={() => onEdit(rule)}
              onDelete={() => onDelete(rule)}
              onDragStart={handleDragStart}
              onDragEnter={handleDragEnter}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface RuleCardProps {
  rule: SopRule;
  isDragging: boolean;
  isOver: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string) => void;
  onDragEnd: () => void;
}

function RuleCard({
  rule, isDragging, isOver,
  onEdit, onDelete,
  onDragStart, onDragEnter, onDragEnd,
}: RuleCardProps) {
  const t = useSettings((s) => s.t());
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(rule.id);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        onDragEnter(rule.id);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      onDrop={(e) => e.preventDefault()}
      className={`group flex items-start gap-2 rounded-md border bg-bg-surface px-4 py-3 transition-all ${
        isDragging ? "opacity-40 border-primary" : isOver ? "border-primary ring-1 ring-primary/30" : "border-border hover:bg-bg-hover"
      }`}
    >
      {/* 拖拽 handle:鼠标悬停时显示,光标变 grab */}
      <div
        className="mt-0.5 cursor-grab text-text-muted opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        title="拖动排序"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-sm font-semibold text-text">{rule.title}</h3>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="rounded p-1 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text"
              title={t.sopPage.editRule}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-1 text-text-muted transition-colors hover:bg-loss/10 hover:text-loss"
              title={t.sopPage.delete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {rule.description && (
          <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{rule.description}</p>
        )}
      </div>
    </div>
  );
}

interface RuleDialogProps {
  rule: SopRule | null;
  onClose: () => void;
  onSave: (data: { category: SopCategory; title: string; description: string }) => void;
}

function RuleDialog({ rule, onClose, onSave }: RuleDialogProps) {
  const t = useSettings((s) => s.t());
  const [title, setTitle] = useState(rule?.title ?? "");
  const [category, setCategory] = useState<SopCategory>(rule?.category ?? "entry");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [error, setError] = useState("");
  const cls = "w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-primary";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError(t.sopPage.titleRequired);
    onSave({ category, title: title.trim(), description: description.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-border bg-bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-text">
            {rule ? t.sopPage.editRule : t.sopPage.addRule}
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">{t.sopPage.ruleTitle}</span>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              className={cls}
            />
            {error && <span className="text-xs text-loss">{error}</span>}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">{t.sopPage.category}</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SopCategory)}
              className={cls}
            >
              <option value="entry">{t.sopPage.entryRules}</option>
              <option value="exit">{t.sopPage.exitRules}</option>
              <option value="risk">{t.sopPage.riskRules}</option>
              <option value="psychology">{t.sopPage.psychologyRules}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">{t.sopPage.ruleDescription}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className={`${cls} resize-none`}
            />
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-bg-hover"
            >
              {t.sopPage.cancel}
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              {t.sopPage.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
