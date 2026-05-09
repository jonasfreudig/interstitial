import { useState, useEffect, useRef, useMemo } from "react";
import FormatToolbar from "../shared/FormatToolbar";
import { TagChip, TagFilterBar, TagPicker } from "../shared/TagSystem";
import { MarkdownContent, formatShort, formatTime, ENTRY_TYPES } from "../../utils/helpers";
import { extractLinks, getLinkSuggestions } from "../../utils/links";

const TEMPLATES = [
  { name: "Meeting Notes", icon: "◎", content: "## Agenda\n\n## Notes\n\n## Action Items\n- [ ] \n\n## Follow-up" },
  { name: "Project Brief", icon: "◈", content: "## Overview\n\n## Goals\n- \n\n## Timeline\n\n## Notes" },
  { name: "Daily Log", icon: "◦", content: () => `## ${new Date().toLocaleDateString()}\n\n### Morning\n\n### Afternoon\n\n### Wins` },
  { name: "Decision Record", icon: "⊞", content: "## Context\n\n## Options\n\n## Decision\n\n## Consequences" },
];

export default function DocsView({
  docs, entries, allTags, onAddDoc, onUpdateDoc, onDeleteDoc, onLinkEntry, onUnlinkEntry,
  activeDocId, setActiveDocId,
  folders = [], onAddFolder, onUpdateFolder, onRemoveFolder
}) {
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState(null);
  const [folderFilter, setFolderFilter] = useState(null); // null = all, "none" = unfiled, folderId
  const [viewMode, setViewMode] = useState("edit"); // "edit" | "preview" | "split"
  const [showLinkSearch, setShowLinkSearch] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showLinkAutocomplete, setShowLinkAutocomplete] = useState(false);
  const [linkAutocompletePos, setLinkAutocompletePos] = useState(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState(null);
  const [renamingValue, setRenamingValue] = useState("");
  
  const contentRef = useRef(null);
  const linkInputRef = useRef(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const activeDoc = useMemo(() => docs.find(d => d.id === activeDocId), [docs, activeDocId]);

  const wordCount = useMemo(() => {
    if (!activeDoc?.content) return 0;
    return activeDoc.content.trim().split(/\s+/).filter(Boolean).length;
  }, [activeDoc?.content]);

  const filtered = useMemo(() => {
    let result = docs;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(d => d.title?.toLowerCase().includes(q) || d.content?.toLowerCase().includes(q) || d.tags?.some(t => t.toLowerCase().includes(q)));
    }
    if (tagFilter) result = result.filter(d => (d.tags || []).includes(tagFilter));
    if (folderFilter === "none") result = result.filter(d => !d.folderId);
    else if (folderFilter) result = result.filter(d => d.folderId === folderFilter);
    return result.sort((a, b) => {
      if (b.pinned && !a.pinned) return 1;
      if (a.pinned && !b.pinned) return -1;
      return (b.updatedAt || b.ts) - (a.updatedAt || a.ts);
    });
  }, [docs, search, tagFilter, folderFilter]);

  const handleNewDoc = () => {
    const doc = onAddDoc({ title: "", content: "", tags: [] });
    setActiveDocId(doc.id);
    setViewMode("edit");
    setShowTemplatePicker(false);
  };

  const handleNewFromTemplate = (tpl) => {
    const content = typeof tpl.content === "function" ? tpl.content() : tpl.content;
    const doc = onAddDoc({ title: tpl.name, content, tags: [] });
    setActiveDocId(doc.id);
    setViewMode("edit");
    setShowTemplatePicker(false);
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

  const backlinks = useMemo(() => {
    if (!activeDoc?.title) return { docs: [], entries: [] };
    const titleLower = activeDoc.title.toLowerCase();
    return {
      docs: docs.filter(d => d.id !== activeDocId && d.content?.toLowerCase().includes(`[[${titleLower}]]`)),
      entries: entries.filter(e => (e.linkedDocs || []).includes(activeDocId) && !(activeDoc.linkedEntryIds || []).includes(e.id))
    };
  }, [activeDoc, docs, entries, activeDocId]);

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
          {/* Folders sidebar section */}
          <div style={{ borderBottom: "1px solid var(--border-light)", padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", flex: 1 }}>Folders</span>
              <button onClick={() => setAddingFolder(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16, padding: "0 2px", lineHeight: 1 }} title="New folder">+</button>
            </div>
            {addingFolder && (
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && newFolderName.trim()) { onAddFolder({ name: newFolderName.trim() }); setNewFolderName(""); setAddingFolder(false); }
                  if (e.key === "Escape") { setAddingFolder(false); setNewFolderName(""); }
                }}
                onBlur={() => { setAddingFolder(false); setNewFolderName(""); }}
                placeholder="Folder name..."
                style={{ width: "100%", padding: "4px 8px", border: "1px solid var(--accent)", borderRadius: 6, background: "var(--bg)", fontFamily: "'Inter', sans-serif", fontSize: 12, color: "var(--text)", outline: "none", marginBottom: 4 }}
              />
            )}
            <button
              onClick={() => setFolderFilter(null)}
              style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "4px 6px", border: "none", borderRadius: 6, background: folderFilter === null ? "var(--accent-light)" : "transparent", color: folderFilter === null ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif", textAlign: "left" }}
            >
              ≡ All Documents <span style={{ marginLeft: "auto", color: "var(--text-tertiary)" }}>{docs.length}</span>
            </button>
            {folders.map(folder => (
              <div key={folder.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                {renamingFolderId === folder.id ? (
                  <input
                    autoFocus
                    value={renamingValue}
                    onChange={e => setRenamingValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && renamingValue.trim()) { onUpdateFolder(folder.id, { name: renamingValue.trim() }); setRenamingFolderId(null); }
                      if (e.key === "Escape") setRenamingFolderId(null);
                    }}
                    onBlur={() => setRenamingFolderId(null)}
                    style={{ flex: 1, padding: "3px 6px", border: "1px solid var(--accent)", borderRadius: 6, background: "var(--bg)", fontFamily: "'Inter', sans-serif", fontSize: 12, color: "var(--text)", outline: "none" }}
                  />
                ) : (
                  <button
                    onClick={() => setFolderFilter(folder.id)}
                    onDoubleClick={() => { setRenamingFolderId(folder.id); setRenamingValue(folder.name); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, padding: "4px 6px", border: "none", borderRadius: 6, background: folderFilter === folder.id ? "var(--accent-light)" : "transparent", color: folderFilter === folder.id ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif", textAlign: "left" }}
                  >
                    <span style={{ fontSize: 13 }}>▸</span>
                    {folder.name}
                    <span style={{ marginLeft: "auto", color: "var(--text-tertiary)" }}>{docs.filter(d => d.folderId === folder.id).length}</span>
                  </button>
                )}
                <button onClick={() => { if (window.confirm(`Delete folder "${folder.name}"?`)) onRemoveFolder(folder.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 12, padding: "2px 4px", opacity: 0.5, flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = "var(--red)"; }} onMouseLeave={e => { e.currentTarget.style.opacity = 0.5; e.currentTarget.style.color = "var(--text-tertiary)"; }} title="Delete folder">×</button>
              </div>
            ))}
            <button
              onClick={() => setFolderFilter("none")}
              style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "4px 6px", border: "none", borderRadius: 6, background: folderFilter === "none" ? "var(--accent-light)" : "transparent", color: folderFilter === "none" ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif", textAlign: "left" }}
            >
              ◦ Unfiled <span style={{ marginLeft: "auto", color: "var(--text-tertiary)" }}>{docs.filter(d => !d.folderId).length}</span>
            </button>
          </div>

          <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border-light)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 600, color: "var(--text)" }}>≡ Documents</span>
              <div style={{ display: "flex", gap: 6, position: "relative" }}>
                <button onClick={() => setShowTemplatePicker(s => !s)} style={{ padding: "6px 12px", background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 16, cursor: "pointer", fontSize: 13, fontFamily: "'Inter', sans-serif" }} title="From template">⊞</button>
                <button onClick={handleNewDoc} style={{ padding: "6px 16px", background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 16, cursor: "pointer", fontSize: 13, fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>+ New</button>
                {showTemplatePicker && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow-md)", zIndex: 100, minWidth: 180, overflow: "hidden" }}>
                    {TEMPLATES.map(tpl => (
                      <button key={tpl.name} onClick={() => handleNewFromTemplate(tpl)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", border: "none", borderBottom: "1px solid var(--border-light)", background: "none", cursor: "pointer", textAlign: "left", fontFamily: "'Inter', sans-serif", fontSize: 13, color: "var(--text)" }} onMouseEnter={e => e.currentTarget.style.background = "var(--accent-light)"} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                        <span style={{ color: "var(--text-tertiary)" }}>{tpl.icon}</span>
                        {tpl.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                <div key={doc.id} style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid var(--border-light)", borderLeft: doc.id === activeDocId ? "3px solid var(--accent)" : "3px solid transparent", background: doc.id === activeDocId ? "var(--accent-light)" : "transparent", transition: "background 0.15s" }}>
                  <button onClick={() => { setActiveDocId(doc.id); setViewMode("edit"); }} style={{ flex: 1, padding: "14px 16px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                      {doc.pinned && <span style={{ color: "var(--amber)", fontSize: 12 }}>★</span>}
                      {doc.title || "Untitled"}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {doc.tags?.slice(0, 2).map(t => <TagChip key={t} tag={t} size="sm" />)}
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif" }}>{formatShort(doc.updatedAt)}</span>
                      {(doc.linkedEntryIds || []).length > 0 && <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: "'Inter', sans-serif" }}>{(doc.linkedEntryIds || []).length} linked</span>}
                    </div>
                  </button>
                  <button onClick={() => onUpdateDoc(doc.id, { pinned: !doc.pinned })} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 10px", color: doc.pinned ? "var(--amber)" : "var(--text-tertiary)", fontSize: 14, opacity: doc.pinned ? 1 : 0.4, flexShrink: 0 }} title={doc.pinned ? "Unpin" : "Pin to top"}>★</button>
                </div>
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
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif" }}>{wordCount} words</span>
                  {folders.length > 0 && (
                    <select
                      value={activeDoc.folderId || ""}
                      onChange={e => onUpdateDoc(activeDocId, { folderId: e.target.value || null })}
                      style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 8px", cursor: "pointer", outline: "none" }}
                    >
                      <option value="">No folder</option>
                      {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  )}
                  <div style={{ flex: 1 }} />
                  <div style={{ display: "flex", gap: 2, border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                    {[["edit", "✎"], ["split", "⊞"], ["preview", "◈"]].map(([m, sym]) => (
                      <button key={m} onClick={() => setViewMode(m)} style={{ padding: "5px 10px", border: "none", borderRadius: 0, background: viewMode === m ? "var(--accent)" : "transparent", color: viewMode === m ? "white" : "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif" }} title={m === "edit" ? "Edit" : m === "split" ? "Split view" : "Preview"}>{sym}</button>
                    ))}
                  </div>
                  <button onClick={() => onUpdateDoc(activeDocId, { pinned: !activeDoc.pinned })} style={{ padding: "5px 10px", border: "1px solid var(--border)", borderRadius: 14, background: activeDoc.pinned ? "rgba(184,115,51,0.1)" : "transparent", color: activeDoc.pinned ? "var(--amber)" : "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontFamily: "'Inter', sans-serif" }} title={activeDoc.pinned ? "Unpin" : "Pin to top"}>★</button>
                  <button onClick={() => { const blob = new Blob([`# ${activeDoc.title}\n\n${activeDoc.content || ""}`], { type: "text/markdown" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${activeDoc.title || "document"}.md`; a.click(); URL.revokeObjectURL(url); }} style={{ padding: "5px 14px", border: "1px solid var(--border)", borderRadius: 14, background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif" }} title="Export as Markdown">↓ .md</button>
                  <button onClick={() => onUpdateDoc(activeDocId, { onCanvas: !activeDoc.onCanvas })} style={{ padding: "5px 14px", border: "1px solid var(--border)", borderRadius: 14, background: activeDoc.onCanvas ? "var(--accent-light)" : "transparent", color: activeDoc.onCanvas ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif" }}>{activeDoc.onCanvas ? "◈ On Canvas" : "◈ To Canvas"}</button>
                  <button onClick={() => { if (window.confirm("Delete this document?")) { onDeleteDoc(activeDocId); setActiveDocId(null); } }} style={{ padding: "5px 14px", border: "1px solid var(--border)", borderRadius: 14, background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif" }}>Delete</button>
                </div>
              </div>
              
              <div style={{ padding: "8px 28px 0", borderBottom: "1px solid var(--border-light)" }}>
                <FormatToolbar value={activeDoc.content || ""} onChange={handleContentChange} textareaRef={contentRef} />
              </div>
              
              <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
                {viewMode !== "preview" && (
                  <div style={{ flex: 1, overflow: "auto", padding: "20px 28px", position: "relative", borderRight: viewMode === "split" ? "1px solid var(--border-light)" : "none" }}>
                    <textarea ref={contentRef} value={activeDoc.content || ""} onChange={e => handleContentChange(e.target.value)} placeholder={"Start writing...\n\n## Formatting\n- **bold** *italic* `code`\n- ## Heading\n- - [ ] Task\n- -! Idea\n- [[Link to entry or doc]]"} style={{ width: "100%", height: "100%", minHeight: 300, border: "none", outline: "none", background: "transparent", fontFamily: "'Newsreader', Georgia, serif", fontSize: 16, lineHeight: 1.8, color: "var(--text)", resize: "none" }} />
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
                )}
                {viewMode !== "edit" && (
                  <div style={{ flex: 1, overflow: "auto", padding: "20px 28px", fontFamily: "'Newsreader', Georgia, serif", fontSize: 16, lineHeight: 1.8, color: "var(--text)" }}>
                    <MarkdownContent text={activeDoc.content || ""} onLinkClick={handleLinkClick} />
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

              {(backlinks.docs.length > 0 || backlinks.entries.length > 0) && (
                <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-card)", padding: "14px 28px", maxHeight: 180, overflow: "auto" }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500, color: "var(--text-tertiary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Referenced by</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {backlinks.docs.map(d => (
                      <button key={d.id} onClick={() => setActiveDocId(d.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--bg)", borderRadius: 6, border: "1px solid var(--border-light)", cursor: "pointer", textAlign: "left" }}>
                        <span style={{ color: "var(--accent)", fontSize: 13 }}>≡</span>
                        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title || "Untitled"}</span>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif" }}>doc</span>
                      </button>
                    ))}
                    {backlinks.entries.map(e => (
                      <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--bg)", borderRadius: 6, border: "1px solid var(--border-light)" }}>
                        <span style={{ color: ENTRY_TYPES[e.type]?.col || "var(--text-tertiary)", fontSize: 13 }}>{ENTRY_TYPES[e.type]?.sym || "◦"}</span>
                        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.text?.slice(0, 80)}</span>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif" }}>entry</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}