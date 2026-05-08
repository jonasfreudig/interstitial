import { useState, useEffect, useRef, useMemo } from "react";
import { TagChip } from "../shared/TagSystem";
import { formatTime, extractInlineTasks, KANBAN_COLS, ENTRY_TYPES } from "../../utils/helpers";

export default function KanbanView({ entries, onUpdateEntry, onAddEntry }) {
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [newTask, setNewTask] = useState("");
  const editRef = useRef(null);

  // Get all tasks (regular + inline)
  const allTasks = useMemo(() => {
    const regularTasks = entries
      .filter(e => e.type === "task")
      .map(e => ({ ...e, isInline: false }));
    
    const inlineTasks = extractInlineTasks(entries);
    
    return [...regularTasks, ...inlineTasks].sort((a, b) => b.ts - a.ts);
  }, [entries]);

  // Focus edit
  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  const saveEdit = (id) => {
    if (editingText.trim()) {
      onUpdateEntry(id, { text: editingText.trim() });
    }
    setEditingId(null);
  };

  const handleQuickAdd = () => {
    if (!newTask.trim()) return;
    onAddEntry({
      text: newTask.trim(),
      type: "task",
      kanban: "backlog",
      done: false,
    });
    setNewTask("");
  };

  return (
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      background: "var(--bg)",
    }}>
      {/* Quick Add Bar */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-card)",
      }}>
        <input
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && newTask.trim()) {
              handleQuickAdd();
            }
          }}
          placeholder="+ Add a task..."
          style={{
            width: "100%",
            maxWidth: 400,
            padding: "10px 16px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg)",
            fontFamily: "'Inter', sans-serif",
            fontSize: 14,
            color: "var(--text)",
            outline: "none",
          }}
        />
      </div>

      {/* Kanban Columns */}
      <div style={{
        flex: 1,
        display: "flex",
        gap: 16,
        padding: "16px 20px",
        overflow: "auto",
      }}>
        {KANBAN_COLS.map(col => {
          const colTasks = allTasks.filter(t => (t.kanban || "backlog") === col.id);
          
          return (
            <div
              key={col.id}
              style={{
                flex: 1,
                minWidth: 260,
                background: "var(--bg-card)",
                border: overCol === col.id ? `2px solid ${col.accent}` : "1px solid var(--border)",
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                transition: "border-color 0.15s, box-shadow 0.15s",
                boxShadow: overCol === col.id ? `0 0 0 3px ${col.accent}22` : "var(--shadow-sm)",
              }}
              onDragOver={e => {
                e.preventDefault();
                setOverCol(col.id);
              }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setOverCol(null);
                }
              }}
              onDrop={() => {
                if (dragId) {
                  onUpdateEntry(dragId, {
                    kanban: col.id,
                    done: col.id === "done"
                  });
                  setDragId(null);
                  setOverCol(null);
                }
              }}
            >
              {/* Column Header */}
              <div style={{
                padding: "14px 16px 12px",
                borderBottom: "1px solid var(--border-light)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: `${col.accent}08`,
              }}>
                <span style={{ fontSize: 16, color: col.accent }}>{col.sym}</span>
                <span style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--text)",
                  flex: 1,
                }}>
                  {col.label}
                </span>
                <span style={{
                  padding: "2px 10px",
                  borderRadius: 12,
                  background: `${col.accent}18`,
                  color: col.accent,
                  fontSize: 12,
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 500,
                }}>
                  {colTasks.length}
                </span>
              </div>

              {/* Column Body */}
              <div style={{
                flex: 1,
                overflow: "auto",
                padding: "12px",
              }}>
                {colTasks.map(task => (
                  <div
                    key={task.id}
                    draggable={editingId !== task.id}
                    onDragStart={() => setDragId(task.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border-light)",
                      borderLeft: task.color ? `3px solid ${task.color}` : `3px solid ${col.accent}`,
                      borderRadius: 8,
                      padding: "12px 14px",
                      marginBottom: 8,
                      cursor: dragId === task.id ? "grabbing" : "grab",
                      opacity: col.id === "done" ? 0.7 : 1,
                      transition: "all 0.15s",
                      boxShadow: dragId === task.id ? "var(--shadow-md)" : "none",
                      transform: dragId === task.id ? "rotate(1deg)" : "none",
                    }}
                    onMouseEnter={e => {
                      if (dragId !== task.id) {
                        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (dragId !== task.id) {
                        e.currentTarget.style.boxShadow = "none";
                      }
                    }}
                  >
                    {/* Task type indicator */}
                    {task.isInline && (
                      <div style={{
                        fontSize: 10,
                        color: "var(--text-tertiary)",
                        fontFamily: "'Inter', sans-serif",
                        marginBottom: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}>
                        <span style={{ color: ENTRY_TYPES[task.parentType]?.col }}>
                          {ENTRY_TYPES[task.parentType]?.sym}
                        </span>
                        From: {task.parentType || "entry"}
                      </div>
                    )}

                    {/* Task content */}
                    {editingId === task.id ? (
                      <div>
                        <textarea
                          ref={editRef}
                          value={editingText}
                          onChange={e => setEditingText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Escape") {
                              setEditingId(null);
                              return;
                            }
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault();
                              saveEdit(task.id);
                            }
                          }}
                          onBlur={() => saveEdit(task.id)}
                          rows={2}
                          style={{
                            width: "100%",
                            border: "none",
                            borderBottom: "2px solid var(--accent)",
                            outline: "none",
                            background: "transparent",
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 14,
                            lineHeight: 1.5,
                            color: "var(--text)",
                            resize: "none",
                          }}
                          onClick={e => e.stopPropagation()}
                          onPointerDown={e => e.stopPropagation()}
                        />
                        <div style={{
                          fontSize: 11,
                          color: "var(--text-tertiary)",
                          marginTop: 4,
                          fontFamily: "'Inter', sans-serif",
                        }}>
                          ⌘+Enter to save · Esc to cancel
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 14,
                          lineHeight: 1.5,
                          color: col.id === "done" ? "var(--text-tertiary)" : "var(--text)",
                          textDecoration: col.id === "done" ? "line-through" : "none",
                          cursor: "text",
                        }}
                        onDoubleClick={() => {
                          setEditingId(task.id);
                          setEditingText(task.text);
                        }}
                      >
                        {task.text}
                      </div>
                    )}

                    {/* Footer */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: "1px solid var(--border-light)",
                    }}>
                      <span style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        fontFamily: "'Inter', sans-serif",
                      }}>
                        {formatTime(task.ts)}
                      </span>

                      {!task.isInline && editingId !== task.id && (
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
                      )}

                      {/* Tags */}
                      {task.tags?.length > 0 && (
                        <div style={{ display: "flex", gap: 3 }}>
                          {task.tags.slice(0, 1).map(t => (
                            <TagChip key={t} tag={t} size="sm" />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {colTasks.length === 0 && (
                  <div style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "var(--text-tertiary)",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13,
                    border: "1.5px dashed var(--border)",
                    borderRadius: 8,
                  }}>
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}