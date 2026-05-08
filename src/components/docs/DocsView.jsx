import { useState, useEffect, useRef, useMemo } from "react";
import FormatToolbar from "../shared/FormatToolbar";
import { TagChip, TagFilterBar, TagPicker } from "../shared/TagSystem";
import { MarkdownContent, formatShort, formatTime, ENTRY_TYPES } from "../../utils/helpers";
import { extractLinks, getLinkSuggestions } from "../../utils/links";

export default function DocsView({ 
  docs, entries, allTags, onAddDoc, onUpdateDoc, onDeleteDoc, onLinkEntry, onUnlinkEntry,
  activeDocId, setActiveDocId 
}) {
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState(null);
  const [preview, setPreview] = useState(false);
  const [showLinkSearch, setShowLinkSearch] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showLinkAutocomplete, setShowLinkAutocomplete] = useState(false);
  const [linkAutocompletePos, setLinkAutocompletePos] = useState(null);
  
  const contentRef = useRef(null);
  const linkInputRef = useRef(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const activeDoc = useMemo(() => docs.find(d => d.id === activeDocId), [docs, activeDocId]);

  const filtered = useMemo(() => {
    let result = docs;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(d => d.title?.toLowerCase().includes(q) || d.content?.toLowerCase().includes(q) || d.tags?.some(t => t.toLowerCase().includes(q)));
    }
    if (tagFilter) result = result.filter(d => (d.tags || []).includes(tagFilter));
    return result.sort((a, b) => (b.updatedAt || b.ts) - (a.updatedAt || a.ts));
  }, [docs, search, tagFilter]);

  const handleNewDoc = () => {
    const doc = onAddDoc({ title: "", content: "", tags: [] });
    setActiveDocId(doc.id);
    setPreview(false);
  };

  const handleContentChange = (content) => {
    if (!activeDoc) return;
    const cursorPos = contentRef.current?.selectionStart;
    if (cursorPos && content) {
      const before = content.slice(0, cursorPos);
      const linkMatch = before.match(/\[\[([^\]]*)$/);
      if (linkMatch) {
        setShowLinkAutocomplete(true);
        setLinkQuery(linkMatch[1]);
      } else setShowLinkAutocomplete(false);
    }
    onUpdateDoc(activeDocId, { content });
  };

  const insertLink = (suggestion) => {
    if (!contentRef.current) return;
    const ta = contentRef.current;
    const cursorPos = ta.selectionStart;
    const content = activeDoc?.content || "";
    const before = content.slice(0, cursorPos);
    const after = content.slice(cursorPos);
    const linkStart = before.lastIndexOf("[[");
    const newBefore = before.slice(0, linkStart);
    const newContent = newBefore + `[[${suggestion.title}]]` + after;
    onUpdateDoc(activeDocId, { content: newContent });
    setShowLinkAutocomplete(false);
    setLinkQuery("");
    setTimeout(() => {
      const newPos = newBefore.length + suggestion.title.length + 4;
      ta.focus();
      ta.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const linkSuggestions = useMemo(() => {
    if (!linkQuery || !showLinkAutocomplete) return [];
    return getLinkSuggestions(linkQuery, entries, docs, [activeDocId]);
  }, [linkQuery, entries, docs, activeDocId, showLinkAutocomplete]);

  const [linkSearchQuery, setLinkSearchQuery] = useState("");
  const linkSearchResults = useMemo(() => {
    if (!linkSearchQuery.trim()) return [];
    const q = linkSearchQuery.toLowerCase();
    return entries.filter(e => e.text?.toLowerCase().includes(q) && !(activeDoc?.linkedEntryIds || []).includes(e.id)).slice(0, 8);
  }, [linkSearchQuery, entries, activeDoc]);

  const linkedEntries = useMemo(() => {
    if (!activeDoc?.linkedEntryIds) return [];
    return activeDoc.linkedEntryIds.map(id => entries.find(e => e.id === id)).filter(Boolean);
  }, [activeDoc, entries]);

  const handleLinkClick = (query) => {
    const matchedEntry = entries.find(e => e.text?.toLowerCase().includes(query.toLowerCase()));
    if (matchedEntry && activeDoc) onLinkEntry(matchedEntry.id, activeDoc.id);
    const matchedDoc = docs.find(d => d.id !== activeDocId && d.title?.toLowerCase().includes(query.toLowerCase()));
    if (matchedDoc) setActiveDocId(matchedDoc.id);
  };

  const showList = !isMobile || !activeDocId;
  const showEditor = !isMobile || activeDocId;

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }} onClick={() => setShowTagPicker(false)}>
      {showList && (
        <div style={{ width: isMobile ? "100%" : 280, minWidth: isMobile ? "100%" : 280, borderRight: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border-light)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 600, color: "var(--text)" }}>≡ Documents</span>
              <button onClick={handleNewDoc} style={{ padding: "6px 16px", background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 16, cursor: "pointer", fontSize: 13, fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>+ New</button>
            </div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", fontSize: 14 }}>◎</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search docs..." style={{ width: "100%", padding: "8px 12px 8px 32px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)", fontFamily: "'Inter', sans-serif", fontSize: 13, color: "var(--text)", outline: "none" }} />
            </div>
            <div style={{ marginTop: 8 }}>
              <TagFilterBar allTags={allTags} activeFilter={tagFilter} onFilterChange={setTagFilter} />
            </div>
          </div>
          
          <div style={{ flex: 1, overflow: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", fontFamily: "'Newsreader', serif", fontSize: 16 }}>{search || tagFilter ? "No matching docs" : "No documents yet"}</div>
            ) : (
              filtered.map(doc => (
                <button key={doc.id} onClick={() => { setActiveDocId(doc.id); setPreview(false); }} style={{ display: "block", width: "100%", padding: "14px 16px", border: "none", borderBottom: "1px solid var(--border-light)", borderLeft: doc.id === activeDocId ? "3px solid var(--accent)" : "3px solid transparent", background: doc.id === activeDocId ? "var(--accent-light)" : "transparent", cursor: "pointer", textAlign: "left", transition: "background 0.15s" }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title || "Untitled"}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {doc.tags?.slice(0, 2).map(t => <TagChip key={t} tag={t} size="sm" />)}
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif" }}>{formatShort(doc.updatedAt)}</span>
                    {(doc.linkedEntryIds || []).length > 0 && <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: "'Inter', sans-serif" }}>{(doc.linkedEntryIds || []).length} linked</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      
      {showEditor && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!activeDoc ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontFamily: "'Newsreader', serif" }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>≡</div>
              <div style={{ fontSize: 20 }}>Select a document or create new</div>
              <div style={{ fontSize: 14, marginTop: 8, fontFamily: "'Inter', sans-serif" }}>Use [[links]] to connect entries and docs</div>
            </div>
          ) : (
            <>
              <div style={{ padding: "20px 28px 12px", borderBottom: "1px solid var(--border-light)" }}>
                {isMobile && (
                  <button onClick={() => setActiveDocId(null)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif", fontSize: 14, cursor: "pointer", marginBottom: 12, display: "flex", alignItems: "center", gap: 4, padding: 0 }}>← Back to list</button>
                )}
                <input value={activeDoc.title || ""} onChange={e => onUpdateDoc(activeDocId, { title: e.target.value })} placeholder="Untitled Document" style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontFamily: "'Newsreader', Georgia, serif", fontSize: 28, fontWeight: 600, color: "var(--text)", marginBottom: 8 }} />
                
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {(activeDoc.tags || []).map(tag => <TagChip key={tag} tag={tag} active onRemove={(t) => { onUpdateDoc(activeDocId, { tags: (activeDoc.tags || []).filter(tg => tg !== t) }); }} />)}
                  <button onClick={(e) => { e.stopPropagation(); setShowTagPicker(!showTagPicker); }} style={{ padding: "3px 10px", border: "1px dashed var(--border)", borderRadius: 14, background: "none", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif", color: "var(--text-tertiary)" }}>+ tag</button>
                  {showTagPicker && (
                    <div style={{ position: "relative" }}>
                      <TagPicker allTags={allTags} selectedTags={activeDoc.tags || []} onAddTag={(tag) => { onUpdateDoc(activeDocId, { tags: [...new Set([...(activeDoc.tags || []), tag])] }); }} onRemoveTag={(tag) => { onUpdateDoc(activeDocId, { tags: (activeDoc.tags || []).filter(t => t !== tag) }); }} onClose={() => setShowTagPicker(false)} />
                    </div>
                  )}
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-light)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif" }}>Updated {formatShort(activeDoc.updatedAt)}</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setPreview(!preview)} style={{ padding: "5px 14px", border: "1px solid var(--border)", borderRadius: 14, background: preview ? "var(--accent)" : "transparent", color: preview ? "white" : "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif" }}>{preview ? "✎ Edit" : "◈ Preview"}</button>
                  <button onClick={() => onUpdateDoc(activeDocId, { onCanvas: !activeDoc.onCanvas })} style={{ padding: "5px 14px", border: "1px solid var(--border)", borderRadius: 14, background: activeDoc.onCanvas ? "var(--accent-light)" : "transparent", color: activeDoc.onCanvas ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif" }}>{activeDoc.onCanvas ? "◈ On Canvas" : "◈ To Canvas"}</button>
                  <button onClick={() => { if (window.confirm("Delete this document?")) { onDeleteDoc(activeDocId); setActiveDocId(null); } }} style={{ padding: "5px 14px", border: "1px solid var(--border)", borderRadius: 14, background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif" }}>Delete</button>
                </div>
              </div>
              
              <div style={{ padding: "8px 28px 0", borderBottom: "1px solid var(--border-light)" }}>
                <FormatToolbar value={activeDoc.content || ""} onChange={handleContentChange} textareaRef={contentRef} />
              </div>
              
              <div style={{ flex: 1, overflow: "auto", padding: "20px 28px", position: "relative" }}>
                {preview ? (
                  <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 16, lineHeight: 1.8, color: "var(--text)" }}>
                    <MarkdownContent text={activeDoc.content || ""} onLinkClick={handleLinkClick} />
                  </div>
                ) : (
                  <textarea ref={contentRef} value={activeDoc.content || ""} onChange={e => handleContentChange(e.target.value)} placeholder={"Start writing...\n\n## Formatting\n- **bold** *italic* `code`\n- ## Heading\n- - [ ] Task\n- -! Idea\n- [[Link to entry or doc]]"} style={{ width: "100%", height: "100%", minHeight: 300, border: "none", outline: "none", background: "transparent", fontFamily: "'Newsreader', Georgia, serif", fontSize: 16, lineHeight: 1.8, color: "var(--text)", resize: "none" }} />
                )}
                {showLinkAutocomplete && linkSuggestions.length > 0 && (
                  <div style={{ position: "absolute", top: linkAutocompletePos?.top || 100, left: linkAutocompletePos?.left || 28, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "var(--shadow-md)", zIndex: 100, maxHeight: 200, overflow: "auto", minWidth: 250 }}>
                    {linkSuggestions.map(s => (
                      <button key={s.id} onClick={() => insertLink(s)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", border: "none", borderBottom: "1px solid var(--border-light)", background: "none", cursor: "pointer", textAlign: "left", fontFamily: "'Inter', sans-serif", fontSize: 13, color: "var(--text)" }} onMouseEnter={e => e.currentTarget.style.background = "var(--accent-light)"} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                        <span style={{ color: "var(--text-tertiary)", fontSize: 14 }}>{s.type === "entry" ? "◎" : "≡"}</span>
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-card)", padding: "16px 28px", maxHeight: 200, overflow: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, color: "var(--text)" }}>Linked Journal Entries ({linkedEntries.length})</span>
                  <button onClick={() => { setShowLinkSearch(!showLinkSearch); setLinkSearchQuery(""); setTimeout(() => linkInputRef.current?.focus(), 100); }} style={{ padding: "5px 12px", border: "1px solid var(--border)", borderRadius: 12, background: "none", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif", color: "var(--text-secondary)" }}>+ Link Entry</button>
                </div>
                
                {showLinkSearch && (
                  <div style={{ marginBottom: 10 }}>
                    <input ref={linkInputRef} value={linkSearchQuery} onChange={e => setLinkSearchQuery(e.target.value)} placeholder="Search entries to link..." style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)", fontFamily: "'Inter', sans-serif", fontSize: 13, color: "var(--text)", outline: "none", marginBottom: 4 }} onKeyDown={e => { if (e.key === "Escape") setShowLinkSearch(false); }} />
                    {linkSearchResults.map(entry => (
                      <button key={entry.id} onClick={() => { onLinkEntry(entry.id, activeDocId); setLinkSearchQuery(""); setShowLinkSearch(false); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", borderBottom: "1px solid var(--border-light)", background: "none", cursor: "pointer", textAlign: "left" }}>
                        <span style={{ color: ENTRY_TYPES[entry.type]?.col || "var(--text-tertiary)" }}>{ENTRY_TYPES[entry.type]?.sym || "◦"}</span>
                        <span style={{ flex: 1, fontSize: 13, fontFamily: "'Inter', sans-serif", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.text?.slice(0, 80)}</span>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif" }}>{formatTime(entry.ts)}</span>
                      </button>
                    ))}
                  </div>
                )}
                
                {linkedEntries.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif", padding: "8px 0" }}>No linked entries. Use [[links]] in your text or click "+ Link Entry" to connect journal entries.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {linkedEntries.map(entry => (
                      <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--bg)", borderRadius: 6, border: "1px solid var(--border-light)" }}>
                        <span style={{ fontSize: 14, color: ENTRY_TYPES[entry.type]?.col || "var(--text-tertiary)" }}>{ENTRY_TYPES[entry.type]?.sym || "◦"}</span>
                        <span style={{ flex: 1, fontSize: 13, fontFamily: "'Inter', sans-serif", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.text?.slice(0, 100)}</span>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{formatTime(entry.ts)}</span>
                        <button onClick={() => onUnlinkEntry(entry.id, activeDocId)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16, padding: "0 4px" }} onMouseEnter={e => e.currentTarget.style.color = "var(--red)"} onMouseLeave={e => e.currentTarget.style.color = "var(--text-tertiary)"}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}