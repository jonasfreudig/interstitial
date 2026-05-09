import { useState, useEffect, useRef, useMemo } from "react";
import { TagChip } from "../shared/TagSystem";
import { formatTime, extractInlineTasks, getTagColor, KANBAN_COLS, ENTRY_TYPES, RECURRENCE_LABELS } from "../../utils/helpers";

const RECURRENCE_OPTIONS = [
  { value: null, label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const PRIORITY = {
  low:    { label: "Low",    sym: "↓", color: "#4a6fa5" },
  medium: { label: "Med",   sym: "→", color: "#b87333" },
  high:   { label: "High",  sym: "↑", color: "#c44a3a" },
  urgent: { label: "!!",    sym: "!!", color: "#9b1c1c" },
};
const PRIORITY_ORDER = [null, "low", "medium", "high", "urgent"];
const COL_ACCENTS = ["#4a6fa5", "#b87333", "#4a7c59", "#7a5c8a", "#5b8888", "#c44a3a", "#9a6040"];

function formatDeadline(deadline) {
  if (!deadline) return null;
  const d = new Date(deadline + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff < -1) return { label: `${-diff}d late`, color: "var(--red)" };
  if (diff === -1) return { label: "Yesterday", color: "var(--red)" };
  if (diff === 0)  return { label: "Today",     color: "#b87333" };
  if (diff === 1)  return { label: "Tomorrow",  color: "#b87333" };
  if (diff <= 7)   return { label: `in ${diff}d`, color: "var(--text-tertiary)" };
  return { label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), color: "var(--text-tertiary)" };
}

export default function KanbanView({ entries, onUpdateEntry, onAddEntry, allTags = [], kanbanCols, setKanbanCols }) {
  const [dragId, setDragId]           = useState(null);
  const [overCol, setOverCol]         = useState(null);
  const [editingId, setEditingId]     = useState(null);
  const [editingText, setEditingText] = useState("");
  const [newTask, setNewTask] = useState("");
  const [recurrencePickerId, setRecurrencePickerId] = useState(null);
  const [expandedId, setExpandedId]   = useState(null);
  const [showTagPicker, setShowTagPicker] = useState(null);
  const [editingColId, setEditingColId]   = useState(null);
  const [editingColLabel, setEditingColLabel] = useState("");
  const [addingCol, setAddingCol]     = useState(false);
  const [newColName, setNewColName]   = useState("");
  const [newTask, setNewTask]         = useState("");
  const [newPriority, setNewPriority] = useState(null);
  const [newDeadline, setNewDeadline] = useState("");

  const editRef   = useRef(null);
  const newColRef = useRef(null);
  const tagInputRef = useRef(null);

  const allTasks = useMemo(() => {
    const regular = entries.filter(e => e.type === "task").map(e => ({ ...e, isInline: false }));
    const inline  = extractInlineTasks(entries);
    return [...regular, ...inline].sort((a, b) => b.ts - a.ts);
  }, [entries]);

  useEffect(() => {
    if (editingId && editRef.current) { editRef.current.focus(); editRef.current.select(); }
  }, [editingId]);

  useEffect(() => {
    if (addingCol && newColRef.current) newColRef.current.focus();
  }, [addingCol]);

  // Close tag picker on outside click
  useEffect(() => {
    if (!showTagPicker) return;
    const handler = (e) => {
      if (!e.target.closest("[data-tag-picker]")) setShowTagPicker(null);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [showTagPicker]);

  const handleQuickAdd = () => {
    if (!newTask.trim()) return;
    onAddEntry({
      text: newTask.trim(), type: "task",
      kanban: kanbanCols[0]?.id || "backlog", done: false,
      priority: newPriority, deadline: newDeadline || null, tags: [],
    });
    setNewTask(""); setNewPriority(null); setNewDeadline("");
  };

  const cycleP = (task) => {
    const idx  = PRIORITY_ORDER.indexOf(task.priority ?? null);
    const next = PRIORITY_ORDER[(idx + 1) % PRIORITY_ORDER.length];
    onUpdateEntry(task.id, { priority: next });
  };

  const addTag = (taskId, tag) => {
    const task = entries.find(e => e.id === taskId);
    if (!task || (task.tags || []).includes(tag)) return;
    onUpdateEntry(taskId, { tags: [...(task.tags || []), tag] });
  };

  const removeTag = (taskId, tag) => {
    const task = entries.find(e => e.id === taskId);
    if (!task) return;
    onUpdateEntry(taskId, { tags: (task.tags || []).filter(t => t !== tag) });
  };

  const addCol = () => {
    if (!newColName.trim()) { setAddingCol(false); return; }
    const id = newColName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now().toString(36);
    const accent = COL_ACCENTS[kanbanCols.length % COL_ACCENTS.length];
    setKanbanCols([...kanbanCols, { id, label: newColName.trim(), sym: "◦", accent }]);
    setNewColName(""); setAddingCol(false);
  };

  const renameCol = (id) => {
    if (editingColLabel.trim()) setKanbanCols(kanbanCols.map(c => c.id === id ? { ...c, label: editingColLabel.trim() } : c));
    setEditingColId(null);
  };

  const deleteCol = (id) => {
    const fallback = kanbanCols.find(c => c.id !== id)?.id || "backlog";
    allTasks.filter(t => (t.kanban || kanbanCols[0]?.id) === id).forEach(t => onUpdateEntry(t.id, { kanban: fallback }));
    setKanbanCols(kanbanCols.filter(c => c.id !== id));
  };

  const inputStyle = {
    border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)",
    fontFamily: "'Inter', sans-serif", fontSize: 14, color: "var(--text)", outline: "none",
    transition: "border-color 0.15s",
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)" }}>

      {/* ── Quick Add ── */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={newTask} onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => e.key === "Enter" && newTask.trim() && handleQuickAdd()}
          placeholder="+ Add task and press Enter..."
          style={{ ...inputStyle, flex: "1 1 180px", minWidth: 160, padding: "9px 14px" }}
          onFocus={e => e.target.style.borderColor = "var(--accent)"}
          onBlur={e => e.target.style.borderColor = "var(--border)"}
        />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {PRIORITY_ORDER.filter(Boolean).map(p => (
            <button key={p} onClick={() => setNewPriority(newPriority === p ? null : p)}
              style={{ padding: "6px 10px", border: `1.5px solid ${newPriority === p ? PRIORITY[p].color : "var(--border)"}`, borderRadius: 8, background: newPriority === p ? `${PRIORITY[p].color}18` : "transparent", color: newPriority === p ? PRIORITY[p].color : "var(--text-tertiary)", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif", transition: "all 0.15s" }}>
              {PRIORITY[p].sym} {PRIORITY[p].label}
            </button>
          ))}
        </div>
        <input type="date" value={newDeadline} onChange={e => setNewDeadline(e.target.value)}
          style={{ ...inputStyle, padding: "6px 10px", fontSize: 13, color: newDeadline ? "var(--text)" : "var(--text-tertiary)" }} />
      </div>

      {/* ── Board ── */}
      <div style={{ flex: 1, display: "flex", gap: 14, padding: "16px 20px", overflow: "auto" }}>
        {kanbanCols.map((col, colIdx) => {
          const colTasks = allTasks.filter(t => (t.kanban || kanbanCols[0]?.id) === col.id);
          const isOver   = overCol === col.id;

          return (
            <div key={col.id}
              style={{ flex: "1 1 260px", minWidth: 240, background: "var(--bg-card)", border: isOver ? `2px solid ${col.accent}` : "1px solid var(--border)", borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden", transition: "border-color 0.15s, box-shadow 0.15s", boxShadow: isOver ? `0 0 0 3px ${col.accent}22` : "var(--shadow-sm)", animation: `slideUp 0.22s cubic-bezier(0.16,1,0.3,1) ${colIdx * 0.05}s both` }}
              onDragOver={e => { e.preventDefault(); setOverCol(col.id); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null); }}
              onDrop={() => { if (dragId) { onUpdateEntry(dragId, { kanban: col.id, done: col.id === "done" }); setDragId(null); setOverCol(null); } }}
            >
              {/* Column Header */}
              <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 8, background: `${col.accent}08` }}>
                <span style={{ fontSize: 15, color: col.accent }}>{col.sym}</span>
                {editingColId === col.id
                  ? <input autoFocus value={editingColLabel} onChange={e => setEditingColLabel(e.target.value)}
                      onBlur={() => renameCol(col.id)}
                      onKeyDown={e => { if (e.key === "Enter") renameCol(col.id); if (e.key === "Escape") setEditingColId(null); }}
                      style={{ flex: 1, fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, border: "none", borderBottom: `2px solid ${col.accent}`, outline: "none", background: "transparent", color: "var(--text)" }} />
                  : <span onDoubleClick={() => { setEditingColId(col.id); setEditingColLabel(col.label); }}
                      style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--text)", flex: 1, userSelect: "none", cursor: "text" }} title="Double-click to rename">
                      {col.label}
                    </span>
                }
                <span style={{ padding: "2px 8px", borderRadius: 10, background: `${col.accent}18`, color: col.accent, fontSize: 11, fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>{colTasks.length}</span>
                {kanbanCols.length > 1 && (
                  <button onClick={() => deleteCol(col.id)} title="Delete column"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 15, opacity: 0, padding: "0 2px", transition: "opacity 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0}>×</button>
                )}
              </div>

              {/* Column Body */}
              <div style={{ flex: 1, overflow: "auto", padding: 10 }}>
                {colTasks.map((task, taskIdx) => {
                  const isExpanded = expandedId === task.id;
                  const dl = formatDeadline(task.deadline);
                  const p  = task.priority ? PRIORITY[task.priority] : null;

                  return (
                    <div key={task.id}
                      draggable={!isExpanded && editingId !== task.id}
                      onDragStart={() => { setDragId(task.id); setExpandedId(null); }}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      style={{ background: "var(--bg)", border: "1px solid var(--border-light)", borderLeft: `3px solid ${p ? p.color : col.accent}`, borderRadius: 8, padding: isExpanded ? "12px 14px 14px" : "10px 12px", marginBottom: 8, cursor: dragId === task.id ? "grabbing" : "grab", opacity: col.id === "done" ? 0.65 : 1, transition: "box-shadow 0.15s, transform 0.15s, padding 0.15s", boxShadow: dragId === task.id ? "var(--shadow-md)" : "none", transform: dragId === task.id ? "rotate(1.5deg) scale(1.02)" : "none", animation: `slideUp 0.18s cubic-bezier(0.16,1,0.3,1) ${taskIdx * 0.03}s both` }}>

                      {/* Top meta row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <button onClick={() => cycleP(task)} title={p ? `Priority: ${p.label} (click to change)` : "Set priority"}
                          style={{ width: 11, height: 11, borderRadius: "50%", background: p ? p.color : "var(--border-light)", border: "none", cursor: "pointer", flexShrink: 0, padding: 0, transition: "transform 0.12s, background 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.4)"}
                          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"} />
                        {p && <span style={{ fontSize: 10, color: p.color, fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>{p.label}</span>}
                        {task.isInline && <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif" }}>from {task.parentType}</span>}
                        {dl && <span style={{ fontSize: 10, color: dl.color, fontFamily: "'Inter', sans-serif", fontWeight: 500, marginLeft: "auto" }}>⏱ {dl.label}</span>}
                      </div>

                      {/* Text */}
                      {editingId === task.id
                        ? <div>
                            <textarea ref={editRef} value={editingText}
                              onChange={e => setEditingText(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Escape") setEditingId(null);
                                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (editingText.trim()) onUpdateEntry(task.id, { text: editingText.trim() }); setEditingId(null); }
                              }}
                              onBlur={() => { if (editingText.trim()) onUpdateEntry(task.id, { text: editingText.trim() }); setEditingId(null); }}
                              rows={2}
                              style={{ width: "100%", border: "none", borderBottom: "2px solid var(--accent)", outline: "none", background: "transparent", fontFamily: "'Inter', sans-serif", fontSize: 14, lineHeight: 1.5, color: "var(--text)", resize: "none" }}
                              onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} />
                            <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 3, fontFamily: "'Inter', sans-serif" }}>⌘+Enter to save · Esc to cancel</div>
                          </div>
                        : <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, lineHeight: 1.5, color: col.id === "done" ? "var(--text-tertiary)" : "var(--text)", textDecoration: col.id === "done" ? "line-through" : "none" }}
                            onDoubleClick={() => { if (!task.isInline) { setEditingId(task.id); setEditingText(task.text); } }}>
                            {task.text}
                          </div>
                      }

                      {!task.isInline && editingId !== task.id && (
                        <>
                          <div style={{ position: "relative" }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); setRecurrencePickerId(recurrencePickerId === task.id ? null : task.id); }}
                              style={{
                                background: task.recurrence ? "rgba(74,111,165,0.1)" : "none",
                                border: "none",
                                cursor: "pointer",
                                color: task.recurrence ? "var(--accent)" : "var(--text-tertiary)",
                                fontSize: 13,
                                padding: "2px 6px",
                                opacity: task.recurrence ? 1 : 0.5,
                                borderRadius: 4,
                              }}
                              title={task.recurrence ? `Repeats ${task.recurrence}` : "Set recurrence"}
                              onMouseEnter={e => e.currentTarget.style.opacity = 1}
                              onMouseLeave={e => { if (!task.recurrence) e.currentTarget.style.opacity = 0.5; }}
                            >
                              ↻{task.recurrence ? ` ${RECURRENCE_LABELS?.[task.recurrence] || task.recurrence}` : ""}
                            </button>
                            {recurrencePickerId === task.id && (
                              <div style={{ position: "absolute", bottom: "calc(100% + 4px)", left: 0, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "var(--shadow-md)", zIndex: 200, minWidth: 140, overflow: "hidden" }}>
                                {RECURRENCE_OPTIONS.map(opt => (
                                  <button
                                    key={String(opt.value)}
                                    onClick={(e) => { e.stopPropagation(); onUpdateEntry(task.id, { recurrence: opt.value }); setRecurrencePickerId(null); }}
                                    style={{ display: "block", width: "100%", padding: "9px 14px", border: "none", borderBottom: "1px solid var(--border-light)", background: task.recurrence === opt.value ? "var(--accent-light)" : "none", color: task.recurrence === opt.value ? "var(--accent)" : "var(--text)", cursor: "pointer", textAlign: "left", fontFamily: "'Inter', sans-serif", fontSize: 13 }}
                                    onMouseEnter={e => { if (task.recurrence !== opt.value) e.currentTarget.style.background = "var(--accent-light)"; }}
                                    onMouseLeave={e => { if (task.recurrence !== opt.value) e.currentTarget.style.background = "none"; }}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setEditingId(task.id);
                              setEditingText(task.text);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--text-tertiary)",
                              fontSize: 13,
                              padding: "2px 6px",
                              opacity: 0.5,
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                            onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                          >
                            ✎
                          </button>
                        </>
                      )}
                      {/* Expanded panel */}
                      {isExpanded && (
                        <div style={{ marginTop: 12, borderTop: "1px solid var(--border-light)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10, animation: "fadeIn 0.15s ease" }}>

                          {/* Priority */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif", minWidth: 52 }}>Priority</span>
                            {PRIORITY_ORDER.filter(Boolean).map(pv => (
                              <button key={pv} onClick={() => onUpdateEntry(task.id, { priority: task.priority === pv ? null : pv })}
                                style={{ padding: "3px 9px", border: `1.5px solid ${task.priority === pv ? PRIORITY[pv].color : "var(--border)"}`, borderRadius: 6, background: task.priority === pv ? `${PRIORITY[pv].color}18` : "transparent", color: task.priority === pv ? PRIORITY[pv].color : "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif", transition: "all 0.12s" }}>
                                {PRIORITY[pv].sym} {PRIORITY[pv].label}
                              </button>
                            ))}
                          </div>

                          {/* Deadline */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif", minWidth: 52 }}>Deadline</span>
                            <input type="date" value={task.deadline || ""} onChange={e => onUpdateEntry(task.id, { deadline: e.target.value || null })}
                              style={{ padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)", color: task.deadline ? "var(--text)" : "var(--text-tertiary)", fontFamily: "'Inter', sans-serif", fontSize: 12, outline: "none" }} />
                            {task.deadline && <button onClick={() => onUpdateEntry(task.id, { deadline: null })} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 15, lineHeight: 1 }}>×</button>}
                          </div>

                          {/* Tags */}
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif", minWidth: 52, lineHeight: "22px" }}>Tags</span>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1 }}>
                              {(task.tags || []).map(t => (
                                <span key={t} onClick={() => removeTag(task.id, t)}
                                  style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 10, background: getTagColor(t), color: "white", fontSize: 11, fontFamily: "'Inter', sans-serif", cursor: "pointer" }}>
                                  {t} <span style={{ opacity: 0.75 }}>×</span>
                                </span>
                              ))}
                              {/* Tag picker */}
                              <div data-tag-picker style={{ position: "relative" }}>
                                <button onClick={() => setShowTagPicker(showTagPicker === task.id ? null : task.id)}
                                  style={{ padding: "2px 8px", borderRadius: 10, border: "1.5px dashed var(--border)", background: "transparent", color: "var(--text-tertiary)", fontSize: 11, fontFamily: "'Inter', sans-serif", cursor: "pointer", transition: "all 0.12s" }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-tertiary)"; }}>
                                  + tag
                                </button>
                                {showTagPicker === task.id && (
                                  <div data-tag-picker style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 300, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 6, boxShadow: "var(--shadow-md)", minWidth: 150, maxHeight: 180, overflow: "auto", animation: "fadeIn 0.12s ease" }}>
                                    {allTags.filter(t => !(task.tags || []).includes(t)).map(t => (
                                      <div key={t} onPointerDown={() => { addTag(task.id, t); setShowTagPicker(null); }}
                                        style={{ padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "'Inter', sans-serif", color: "var(--text)", transition: "background 0.1s" }}
                                        onMouseEnter={e => e.currentTarget.style.background = "var(--accent-light)"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                        {t}
                                      </div>
                                    ))}
                                    <div style={{ borderTop: "1px solid var(--border-light)", marginTop: 4, paddingTop: 4, paddingLeft: 10, paddingRight: 10 }}>
                                      <input ref={tagInputRef} placeholder="New tag…"
                                        onKeyDown={e => { if (e.key === "Enter" && e.target.value.trim()) { addTag(task.id, e.target.value.trim()); setShowTagPicker(null); } if (e.key === "Escape") setShowTagPicker(null); }}
                                        style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12, fontFamily: "'Inter', sans-serif", color: "var(--text)", padding: "3px 0" }} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Footer */}
                      <div style={{ display: "flex", alignItems: "center", marginTop: 8, paddingTop: 6, borderTop: "1px solid var(--border-light)", gap: 4 }}>
                        <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif", flex: 1 }}>{formatTime(task.ts)}</span>
                        {/* Compact tags (when collapsed) */}
                        {!isExpanded && (task.tags || []).length > 0 && (
                          <div style={{ display: "flex", gap: 3 }}>
                            {task.tags.slice(0, 2).map(t => (
                              <span key={t} style={{ padding: "1px 6px", borderRadius: 8, background: getTagColor(t), color: "white", fontSize: 10, fontFamily: "'Inter', sans-serif" }}>{t}</span>
                            ))}
                            {task.tags.length > 2 && <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif" }}>+{task.tags.length - 2}</span>}
                          </div>
                        )}
                        {!task.isInline && (
                          <button onClick={() => { setEditingId(task.id); setEditingText(task.text); setExpandedId(null); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 13, padding: "2px 4px", opacity: 0.45, transition: "opacity 0.12s" }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                            onMouseLeave={e => e.currentTarget.style.opacity = 0.45}
                            title="Edit text">✎</button>
                        )}
                        <button onClick={() => setExpandedId(isExpanded ? null : task.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: isExpanded ? "var(--accent)" : "var(--text-tertiary)", fontSize: 13, padding: "2px 4px", opacity: isExpanded ? 1 : 0.45, transition: "all 0.12s" }}
                          onMouseEnter={e => e.currentTarget.style.opacity = 1}
                          onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.opacity = 0.45; }}
                          title={isExpanded ? "Collapse" : "Priority · Deadline · Tags"}>⊕</button>
                      </div>
                    </div>
                  );
                })}

                {colTasks.length === 0 && (
                  <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif", fontSize: 13, border: "1.5px dashed var(--border)", borderRadius: 8 }}>
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Column */}
        {addingCol
          ? <div style={{ minWidth: 240, background: "var(--bg-card)", border: "2px dashed var(--accent)", borderRadius: 12, padding: "14px 16px", alignSelf: "flex-start", animation: "fadeIn 0.15s ease" }}>
              <input ref={newColRef} value={newColName} onChange={e => setNewColName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addCol(); if (e.key === "Escape") { setAddingCol(false); setNewColName(""); } }}
                onBlur={() => { if (!newColName.trim()) { setAddingCol(false); } else addCol(); }}
                placeholder="Column name…"
                style={{ width: "100%", border: "none", borderBottom: "2px solid var(--accent)", outline: "none", background: "transparent", fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--text)", padding: "4px 0" }} />
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6, fontFamily: "'Inter', sans-serif" }}>Enter to add · Esc to cancel</div>
            </div>
          : <div onClick={() => setAddingCol(true)}
              style={{ minWidth: 48, border: "2px dashed var(--border)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 24, transition: "all 0.15s", alignSelf: "stretch" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "var(--accent-light)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.background = "transparent"; }}
              title="Add column">+</div>
        }
      </div>
    </div>
  );
}
