import { useState, useEffect, useRef, useMemo } from "react";
import FormatToolbar from "../shared/FormatToolbar";
import { TagChip, TagFilterBar, TagPicker, ColorPicker } from "../shared/TagSystem";
import { MarkdownContent, ENTRY_TYPES, formatTime, formatDate, formatShort } from "../../utils/helpers";
import { extractLinks } from "../../utils/links";

export default function JournalView({
  entries, docs, onAddEntry, onUpdateEntry, onRemoveEntry, linkMap, allTags, openDoc, onSendToCanvas
}) {
  const [input, setInput] = useState("");
  const [inputType, setInputType] = useState("note");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [metaEntryId, setMetaEntryId] = useState(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  
  const capRef = useRef(null);
  const editRef = useRef(null);
  const dateRefs = useRef({});

  // Mobile detection to completely prevent auto-opening the keyboard
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ONLY focus if not mobile
  useEffect(() => {
    if (!isMobile && capRef.current) {
      setTimeout(() => capRef.current?.focus(), 100);
    }
  }, [isMobile]);

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus();
  }, [editingId]);

  const handleAdd = () => {
    if (!input.trim()) return;
    const links = extractLinks(input);
    const linkedDocs = [];
    links.forEach(link => {
      const matchedDoc = docs.find(d => d.title?.toLowerCase().includes(link.query.toLowerCase()));
      if (matchedDoc) linkedDocs.push(matchedDoc.id);
    });
    
    onAddEntry({ text: input.trim(), type: inputType, linkedDocs });
    setInput("");
    if (!isMobile) capRef.current?.focus();
  };

  const saveEdit = (id) => {
    if (editingText.trim()) {
      const links = extractLinks(editingText);
      const linkedDocs = [];
      links.forEach(link => {
        const matchedDoc = docs.find(d => d.title?.toLowerCase().includes(link.query.toLowerCase()));
        if (matchedDoc) linkedDocs.push(matchedDoc.id);
      });
      onUpdateEntry(id, { text: editingText.trim(), linkedDocs: [...new Set([...(entries.find(e => e.id === id)?.linkedDocs || []), ...linkedDocs])] });
    }
    setEditingId(null);
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditingText(entry.text);
    setMetaEntryId(null);
  };

  const cycleType = (type) => {
    const types = ["note", "task", "idea"];
    return types[(types.indexOf(type) + 1) % types.length];
  };

  const grouped = useMemo(() => {
    let filteredEntries = entries;
    let filteredDocs = docs;
    
    if (search.trim()) {
      const q = search.toLowerCase();
      filteredEntries = filteredEntries.filter(e => e.text?.toLowerCase().includes(q) || e.tags?.some(t => t.toLowerCase().includes(q)));
      filteredDocs = filteredDocs.filter(d => d.title?.toLowerCase().includes(q) || d.content?.toLowerCase().includes(q) || d.tags?.some(t => t.toLowerCase().includes(q)));
    }
    if (tagFilter) {
      filteredEntries = filteredEntries.filter(e => (e.tags || []).includes(tagFilter));
      filteredDocs = filteredDocs.filter(d => (d.tags || []).includes(tagFilter));
    }
    
    const map = {};
    const order = [];
    const timelineItems = [...filteredEntries.map(e => ({ ...e, _isDoc: false })), ...filteredDocs.map(d => ({ ...d, _isDoc: true, ts: d.ts }))].sort((a, b) => b.ts - a.ts);

    timelineItems.forEach(item => {
      const date = formatDate(item.ts);
      if (!map[date]) { map[date] = []; order.push(date); }
      map[date].push(item);
    });
    return { map, order };
  }, [entries, docs, search, tagFilter]);

  const scrollToDate = (date) => {
    dateRefs.current[date]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setShowDateMenu(false);
  };

  const toggleInlineTask = (entryId, lineIndex) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    const lines = entry.text.split("\n");
    if (lines[lineIndex].startsWith("- [ ] ")) lines[lineIndex] = lines[lineIndex].replace("- [ ] ", "- [x] ");
    else if (lines[lineIndex].startsWith("- [x] ")) lines[lineIndex] = lines[lineIndex].replace("- [x] ", "- [ ] ");
    onUpdateEntry(entryId, { text: lines.join("\n") });
  };

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "20px 16px 40px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        
        {/* Composer */}
        <div style={{ background: "var(--bg-card)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "16px 20px", marginBottom: 16, boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "var(--text-tertiary)" }}>{formatTime(Date.now())}</span>
            <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
            <span style={{ padding: "2px 10px", borderRadius: 12, background: ENTRY_TYPES[inputType]?.col, color: "white", fontSize: 12, fontFamily: "'Inter', sans-serif" }}>
              {ENTRY_TYPES[inputType]?.sym} {ENTRY_TYPES[inputType]?.label}
            </span>
          </div>
          
          <FormatToolbar value={input} onChange={setInput} textareaRef={capRef} />
          
          <textarea
            ref={capRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="What's on your mind? (⌘+Enter to save) Use [[doc title]] to link documents..."
            rows={Math.min(8, Math.max(2, input.split("\n").length))}
            style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontFamily: "'Newsreader', Georgia, serif", fontSize: 16, lineHeight: 1.7, color: "var(--text)", resize: "none" }}
          />
          
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-light)" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {Object.entries(ENTRY_TYPES).filter(([k]) => k !== "sketch" && k !== "image").map(([type, { sym, label, col }]) => (
                <button
                  key={type}
                  onClick={() => setInputType(type)}
                  style={{ padding: "4px 12px", border: `1.5px solid ${inputType === type ? col : "var(--border)"}`, borderRadius: 14, background: inputType === type ? col : "transparent", color: inputType === type ? "white" : "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Inter', sans-serif", transition: "all 0.15s" }}
                >
                  {sym} {label}
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={handleAdd} disabled={!input.trim()} style={{ padding: "6px 22px", background: input.trim() ? "var(--text)" : "var(--border)", color: input.trim() ? "var(--bg)" : "var(--text-tertiary)", border: "none", borderRadius: 20, cursor: input.trim() ? "pointer" : "default", fontSize: 15, fontFamily: "'Inter', sans-serif", fontWeight: 500, transition: "opacity 0.15s" }}>
              Add →
            </button>
          </div>
        </div>

        {/* Search & Tag Filter */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", fontSize: 14 }}>◎</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries and docs..." style={{ width: "100%", padding: "9px 36px", border: "1.5px solid var(--border)", borderRadius: 8, background: "var(--bg-card)", fontFamily: "'Inter', sans-serif", fontSize: 14, color: "var(--text)", outline: "none" }} />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 18 }}>×</button>}
          </div>
          
          {grouped.order.length > 0 && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowDateMenu(!showDateMenu)} style={{ padding: "9px 14px", border: "1.5px solid var(--border)", borderRadius: 8, background: "var(--bg-card)", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 14, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                ◎ Jump
              </button>
              {showDateMenu && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow-md)", zIndex: 100, maxHeight: 260, overflow: "auto", minWidth: 180, padding: 4 }}>
                  {grouped.order.map(date => (
                    <button key={date} onClick={() => scrollToDate(date)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "8px 12px", border: "none", background: "none", borderRadius: 6, cursor: "pointer", textAlign: "left", fontFamily: "'Inter', sans-serif", fontSize: 14, color: "var(--text)" }} onMouseEnter={e => e.currentTarget.style.background = "var(--accent-light)"} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                      {date} <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{grouped.map[date].length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        {allTags.length > 0 && (
          <div style={{ paddingBottom: 16 }}>
            <TagFilterBar allTags={allTags} activeFilter={tagFilter} onFilterChange={setTagFilter} />
          </div>
        )}

        {/* Unified Timeline */}
        {grouped.order.length === 0 ? (
          <div className="emp" style={{ textAlign: "center", padding: "60px 0", color: "var(--text-tertiary)" }}>
            {search || tagFilter ? "No matching entries found." : (
              <><div style={{ fontSize: 36, marginBottom: 12 }}>◎</div><div>Nothing yet — capture your first thought above.</div></>
            )}
          </div>
        ) : (
          grouped.order.map(date => (
            <div key={date}>
              <div className="dlbl" ref={el => dateRefs.current[date] = el}>{date}</div>
              
              {grouped.map[date].map(item => (
                <div key={item.id} className="ent" onClick={() => { setMetaEntryId(null); setShowTagPicker(false); }}>
                  <span className="et">{formatTime(item.ts)}</span>
                  
                  {item._isDoc ? (
                    <>
                      <button className="etyp" style={{ color: "var(--accent)" }}>≡</button>
                      <div className="etxt-wrap" onClick={() => openDoc && openDoc(item.id)} style={{ cursor: "pointer" }}>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                          {item.title || "Untitled Document"}
                        </div>
                        <div style={{ fontFamily: "'Newsreader', serif", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                          {item.content?.replace(/[#*`\[\]!\-]/g, "").slice(0, 150)}...
                        </div>
                        {(item.tags || []).length > 0 && (
                          <div className="entry-tags" style={{ marginTop: 8 }}>
                            {(item.tags || []).map(tag => <TagChip key={tag} tag={tag} active size="sm" />)}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <button className="etyp" style={{ color: ENTRY_TYPES[item.type]?.col || "#888" }} onClick={() => item.type !== "sketch" && onUpdateEntry(item.id, { type: cycleType(item.type) })} disabled={item.type === "sketch"}>
                        {ENTRY_TYPES[item.type]?.sym || "◦"}
                      </button>
                      
                      {item.type === "task" && (
                        <input type="checkbox" style={{ marginTop: 4, width: 15, height: 15, cursor: "pointer", accentColor: "var(--accent)" }} checked={!!item.done} onChange={e => onUpdateEntry(item.id, { done: e.target.checked, kanban: e.target.checked ? "done" : (item.kanban === "done" ? "backlog" : item.kanban) })} />
                      )}
                      
                      <div className="etxt-wrap" onClick={e => e.stopPropagation()}>
                        {editingId === item.id ? (
                          <div>
                            <textarea ref={editRef} className="edit-ta" value={editingText} rows={Math.max(3, editingText.split("\n").length)} onChange={e => setEditingText(e.target.value)} onKeyDown={e => { if (e.key === "Escape") setEditingId(null); if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); saveEdit(item.id); } }} onBlur={() => saveEdit(item.id)} />
                            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "'Inter', sans-serif" }}>⌘+Enter to save · Esc to cancel</div>
                          </div>
                        ) : item.type === "sketch" ? (
                          <span className="etxt" style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>[Hand-drawn sketch — view in Ideas tab]</span>
                        ) : (
                          <div className="etxt" onDoubleClick={() => startEdit(item)}>
                            <MarkdownContent text={item.text} onToggleTask={(idx) => toggleInlineTask(item.id, idx)} onLinkClick={(q) => { const doc = docs.find(d => d.title?.toLowerCase().includes(q.toLowerCase())); if (doc && openDoc) openDoc(doc.id); }} />
                          </div>
                        )}
                        
                        <div className="entry-tags" style={{ marginTop: 8 }}>
                          {(item.tags || []).map(tag => <TagChip key={tag} tag={tag} active size="sm" onRemove={(t) => onUpdateEntry(item.id, { tags: item.tags.filter(tg => tg !== t)})} />)}
                          <button onClick={() => { setMetaEntryId(metaEntryId === item.id ? null : item.id); setShowTagPicker(!showTagPicker); }} style={{ padding: "2px 8px", border: "1px dashed var(--border)", borderRadius: 10, background: "none", cursor: "pointer", fontSize: 11, fontFamily: "'Inter', sans-serif", color: "var(--text-tertiary)" }}>+ tag</button>
                          {linkMap[item.id]?.docs?.map(d => <button key={d.id} style={{ fontSize: 12, background: "var(--accent-light)", color: "var(--accent)", border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }} onClick={() => openDoc && openDoc(d.id)}>↗ {d.title}</button>)}
                        </div>

                        {metaEntryId === item.id && (
                          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", boxShadow: "var(--shadow-md)", minWidth: 224, marginTop: 6, position: "absolute", zIndex: 50 }} onClick={e => e.stopPropagation()}>
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 5, fontFamily: "'Inter', sans-serif", textTransform: "uppercase" }}>Color</div>
                              <ColorPicker value={item.color} onChange={c => onUpdateEntry(item.id, { color: c === item.color ? null : c })} onClear={() => onUpdateEntry(item.id, { color: null })} />
                            </div>
                            {showTagPicker && (
                              <div style={{ position: "relative", marginTop: 8 }}>
                                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 5, fontFamily: "'Inter', sans-serif", textTransform: "uppercase" }}>Tags</div>
                                <TagPicker allTags={allTags} selectedTags={item.tags || []} onAddTag={t => onUpdateEntry(item.id, { tags: [...new Set([...(item.tags || []), t])] })} onRemoveTag={t => onUpdateEntry(item.id, { tags: (item.tags || []).filter(tg => tg !== t) })} onClose={() => setShowTagPicker(false)} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {item.type !== "sketch" && <button className="eedit" onClick={() => startEdit(item)} title="Edit">✎</button>}
                      {onSendToCanvas && item.type !== "sketch" && (
                        <button
                          className="eedit"
                          onClick={() => onSendToCanvas(item)}
                          title={item.type === "idea" ? "View on Canvas" : "Send to Canvas"}
                          style={{ fontSize: 13 }}
                        >◈</button>
                      )}
                      <button className="edel" onClick={() => onRemoveEntry(item.id)}>×</button>
                      <div className={`entry-ribbon ${item.color ? "" : "no-color"}`} style={{ background: item.color || "var(--border)" }} onClick={(e) => { e.stopPropagation(); setMetaEntryId(metaEntryId === item.id ? null : item.id); setEditingId(null); }} title="Color & tags" />
                    </>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}