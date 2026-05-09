import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { AppProvider, useAppContext } from "./context/AppContext.jsx";
import { formatTime, formatDate, formatShort, generateId, ENTRY_TYPES, KANBAN_COLS } from "./utils/helpers.jsx";
import { extractLinks, resolveLinks, processBidirectionalLinks } from "./utils/links.jsx";
import AuthView from "./components/auth/AuthView";
import Nav from "./components/layout/Nav";
import MobileNav from "./components/layout/MobileNav";
import JournalView from "./components/journal/JournalView";
import KanbanView from "./components/kanban/KanbanView";
import IdeasCanvas from "./components/ideas/IdeasCanvas";
import DocsView from "./components/docs/DocsView";
import PomodoroTimer from "./components/timer/PomodoroTimer";

// ---- CSS Import ----
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap');

:root {
  --bg: #faf8f5;
  --bg-card: #ffffff;
  --text: #1a1a1a;
  --text-secondary: #666666;
  --text-tertiary: #999999;
  --border: #e5e5e5;
  --border-light: #f0f0f0;
  --accent: #4a6fa5;
  --accent-light: rgba(74, 111, 165, 0.1);
  --amber: #b87333;
  --green: #4a7c59;
  --red: #c44a3a;
  --purple: #7a5c8a;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
}

@media (prefers-color-scheme: dark) {
  body:not([data-theme="light"]):not([data-theme="sepia"]) {
    --bg: #1a1a1a;
    --bg-card: #262626;
    --text: #e5e5e5;
    --text-secondary: #a3a3a3;
    --text-tertiary: #737373;
    --border: #404040;
    --border-light: #333333;
    --accent-light: rgba(74, 111, 165, 0.2);
  }
}

body[data-theme="dark"] {
  --bg: #1a1a1a;
  --bg-card: #262626;
  --text: #e5e5e5;
  --text-secondary: #a3a3a3;
  --text-tertiary: #737373;
  --border: #404040;
  --border-light: #333333;
  --accent-light: rgba(74, 111, 165, 0.2);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Newsreader', Georgia, serif;
  background: var(--bg);
  color: var(--text);
  height: 100dvh;
  overflow: hidden;
}

#root {
  height: 100dvh;
  display: flex;
  flex-direction: column;
}

/* Layout */
.app-container {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-content {
  flex: 1;
  overflow: hidden;
}

/* Navigation */
.nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  font-family: 'Inter', sans-serif;
  z-index: 100;
}

.nav-logo {
  font-size: 20px;
  font-weight: 600;
  margin-right: auto;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Newsreader', serif;
}

.nav-logo-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}

.nav-btn {
  padding: 6px 16px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  font-family: 'Inter', sans-serif;
  transition: all 0.15s;
}

.nav-btn:hover {
  color: var(--text);
  background: var(--accent-light);
}

.nav-btn.active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.nav-btn .badge {
  background: var(--red);
  color: white;
  border-radius: 50%;
  padding: 2px 6px;
  font-size: 11px;
  margin-left: 4px;
}

/* Mobile Navigation */
.mobile-nav {
  display: none;
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 28px;
  padding: 6px 8px;
  gap: 4px;
  z-index: 200;
  box-shadow: var(--shadow-lg);
  font-family: 'Inter', sans-serif;
}

.mobile-nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 20px;
  border: none;
  border-radius: 22px;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  gap: 2px;
}

.mobile-nav-btn.active {
  background: var(--accent);
  color: white;
}

.mobile-nav-btn .sym { font-size: 18px; }
.mobile-nav-btn .lbl { font-size: 10px; }

/* Shared Components */
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
  font-family: 'Inter', sans-serif;
  color: white;
}

.tag-chip:hover {
  opacity: 0.85;
  transform: scale(1.02);
}

.tag-chip.outline {
  background: transparent !important;
  border: 1.5px solid;
  color: var(--text);
}

.tag-filter-bar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 8px 0;
  align-items: center;
}

.tag-filter-label {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: 'Inter', sans-serif;
  margin-right: 4px;
}

.markdown-content {
  line-height: 1.7;
  word-break: break-word;
}

.markdown-content strong { font-weight: 600; }
.markdown-content em { font-style: italic; }
.markdown-content code {
  background: var(--accent-light);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.9em;
  font-family: 'Courier New', monospace;
}

.markdown-content a {
  color: var(--accent);
  text-decoration: underline;
  cursor: pointer;
}

.markdown-content h2 {
  font-size: 1.3em;
  font-weight: 600;
  margin: 12px 0 6px;
}

.markdown-content h3 {
  font-size: 1.1em;
  font-weight: 600;
  margin: 8px 0 4px;
}

.task-line {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin: 4px 0;
}

.task-line input[type="checkbox"] {
  margin-top: 4px;
  accent-color: var(--accent);
}

.task-line.done span {
  text-decoration: line-through;
  color: var(--text-tertiary);
}

.idea-line {
  background: rgba(184, 115, 51, 0.08);
  border-left: 3px solid var(--amber);
  padding: 4px 10px;
  margin: 4px 0;
  border-radius: 0 4px 4px 0;
}

.blockquote-line {
  border-left: 3px solid var(--border);
  padding: 4px 12px;
  margin: 4px 0;
  color: var(--text-secondary);
  font-style: italic;
}

.doc-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--accent-light);
  border-radius: 4px;
  color: var(--accent) !important;
  text-decoration: none !important;
  font-size: 0.9em;
  cursor: pointer;
}

.link-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  background: var(--accent-light);
  border-radius: 10px;
  font-size: 11px;
  color: var(--accent);
  cursor: pointer;
  font-family: 'Inter', sans-serif;
}

.link-badge:hover {
  background: var(--accent);
  color: white;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

@media (max-width: 640px) {
  .nav { padding: 10px 14px; }
  .nav-btn { display: none; }
  .nav-logo { font-size: 18px; }
  .mobile-nav { display: flex; }
  .app-content { padding-bottom: 80px; }
}

/* Journal Flat Layout */
.dlbl{font-family:'Newsreader',serif;font-size:20px;font-weight:600;color:var(--text-secondary);padding:28px 0 8px;display:flex;align-items:center;gap:10px;}
.dlbl::after{content:'';flex:1;height:1px;background:var(--border-light);}
.ent{display:flex;align-items:flex-start;gap:12px;padding:12px 18px 12px 8px;border-bottom:1px solid var(--border-light);position:relative;border-radius:6px;margin:0 -8px;transition:background 0.12s;}
.ent:hover{background:var(--accent-light);}
.ent:hover .eedit,.ent:hover .edel{opacity:1;}
.et{font-family:'Inter',sans-serif;font-size:13px;color:var(--text-tertiary);min-width:45px;padding-top:3px;flex-shrink:0;}
.etyp{background:none;border:none;cursor:pointer;font-size:17px;line-height:1;padding:1px 2px;min-width:22px;flex-shrink:0;}
.etxt-wrap{flex:1;min-width:0;}
.etxt{font-family:'Newsreader',Georgia,serif;font-size:16px;line-height:1.68;color:var(--text);word-break:break-word;}
.edit-ta{width:100%;border:none;outline:none;background:transparent;font-family:'Newsreader',Georgia,serif;font-size:16px;line-height:1.68;color:var(--text);resize:none;border-bottom:1.5px solid var(--accent);padding-bottom:2px;}
.eedit,.edel{background:none;border:none;color:var(--text-tertiary);font-size:16px;cursor:pointer;opacity:0;padding:0 4px;}
.edel:hover{color:var(--red);}
.eedit:hover{color:var(--accent);}
.entry-ribbon{position:absolute;right:0;top:3px;bottom:3px;width:4px;border-radius:3px;opacity:0.75;}
.entry-ribbon.no-color{opacity:0;background:var(--border);}
.ent:hover .entry-ribbon.no-color{opacity:0.4;}

/* Idea Canvas Elements & Dark Mode */
.inote{position:absolute;background:var(--bg-card);border:1px solid var(--border);border-bottom:3px solid var(--border);border-radius:6px;padding:24px 14px 10px;box-shadow:var(--shadow-sm);transition:box-shadow 0.15s;}
.inote.isel{border-color:var(--amber);box-shadow:0 0 0 2.5px rgba(184,115,51,0.4);}
.inote-pin{position:absolute;top:-10px;left:50%;transform:translateX(-50%);width:16px;height:16px;border-radius:50%;background:var(--amber);border:2.5px solid var(--bg);box-shadow:0 2px 5px var(--shadow-sm);}

/* Base Theme Switching setup */
[data-theme="sepia"] {
  --bg: #f2ebe0; --bg-card: #fffde8; --text: #2c2010; --text-secondary: #4a3c2e; --text-tertiary: #7a6e62;
  --border: #d8cfbe; --border-light: #e8e0d4; --accent-light: rgba(74, 111, 165, 0.1);
}

/* Animations */
@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.anim-view { animation: slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }
.anim-fade { animation: fadeIn 0.15s ease both; }
`;

// ---- Global Search Component ----
function GlobalSearch({ entries, docs, onClose, onOpenDoc, setView }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const query = q.toLowerCase();
    const docResults = docs
      .filter(d => d.title?.toLowerCase().includes(query) || d.content?.toLowerCase().includes(query) || d.tags?.some(t => t.toLowerCase().includes(query)))
      .slice(0, 5)
      .map(d => ({ type: "doc", id: d.id, label: d.title || "Untitled", sym: "≡", col: "var(--accent)" }));
    const entryResults = entries
      .filter(e => e.text?.toLowerCase().includes(query) || e.tags?.some(t => t.toLowerCase().includes(query)))
      .slice(0, 5)
      .map(e => ({ type: "entry", id: e.id, label: e.text?.slice(0, 70) || "(empty)", sym: ENTRY_TYPES[e.type]?.sym || "◦", col: ENTRY_TYPES[e.type]?.col }));
    return [...docResults, ...entryResults].slice(0, 8);
  }, [q, entries, docs]);

  const go = (r) => {
    if (r.type === "doc") onOpenDoc(r.id);
    else setView("journal");
    onClose();
  };

  const onKey = (e) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[sel]) go(results[sel]);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "16vh" }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow-lg)", width: "100%", maxWidth: 560, margin: "0 16px", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border-light)" }}>
          <span style={{ color: "var(--text-tertiary)", fontSize: 18 }}>◎</span>
          <input
            ref={inputRef}
            value={q}
            onChange={e => { setQ(e.target.value); setSel(0); }}
            onKeyDown={onKey}
            placeholder="Search entries and docs..."
            style={{ flex: 1, border: "none", outline: "none", fontFamily: "'Inter', sans-serif", fontSize: 16, background: "transparent", color: "var(--text)" }}
          />
          <kbd style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "var(--text-tertiary)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px" }}>Esc</kbd>
        </div>
        {q.trim() && results.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif", fontSize: 14 }}>No results for "{q}"</div>
        ) : !q.trim() ? (
          <div style={{ padding: "16px", textAlign: "center", color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif", fontSize: 13 }}>
            Type to search across all entries and docs
            <span style={{ margin: "0 6px" }}>·</span>
            <kbd style={{ fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px" }}>↑↓</kbd> navigate
            <span style={{ margin: "0 6px" }}>·</span>
            <kbd style={{ fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px" }}>↩</kbd> open
          </div>
        ) : results.map((r, i) => (
          <div
            key={r.id}
            onClick={() => go(r)}
            onMouseEnter={() => setSel(i)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: i === sel ? "var(--accent-light)" : "transparent", cursor: "pointer", borderBottom: i < results.length - 1 ? "1px solid var(--border-light)" : "none" }}
          >
            <span style={{ color: r.col, fontSize: 15, flexShrink: 0 }}>{r.sym}</span>
            <span style={{ flex: 1, fontFamily: "'Inter', sans-serif", fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif", flexShrink: 0 }}>{r.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Main App Component ----
function AppContent() {
  const [view, setView] = useState("journal");
  const [syncStatus, setSyncStatus] = useState("synced");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');
  const [kanbanCols, setKanbanCols] = useState(KANBAN_COLS)
  const [showSearch, setShowSearch] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);

  // Lifted state to allow "Jump to Doc" to work seamlessly globally
  const [activeDocId, setActiveDocId] = useState(null);

  const openDoc = useCallback((docId) => {
    setActiveDocId(docId);
    setView("docs");
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(s => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const {
    entries, setEntries,
    docs, setDocs,
    connections, setConnections,
    frames, setFrames,
    bgStrokes, setBgStrokes,
    folders, setFolders,
    allTags,
    addEntry, updateEntry, removeEntry,
    addDoc, updateDoc, deleteDoc,
    linkEntryToDoc, unlinkEntryFromDoc,
    addConnection, removeConnection,
    updateFrame, addFrame, removeFrame,
    addFolder, updateFolder, removeFolder,
    processAllLinks
  } = useAppContext();

  // Load data
  useEffect(() => {
    if (!supabase.auth.getSession()) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        const { data, error } = await supabase
          .from("user_journals")
          .select("data")
          .eq("user_id", session.user.id)
          .single();
          
        if (error && error.code !== "PGRST116") throw error;
        
        if (data?.data) {
          setEntries(data.data.entries || []);
          setDocs(data.data.docs || []);
          setConnections(data.data.connections || []);
          setFrames(data.data.frames || []);
          setBgStrokes(data.data.bgStrokes || []);
          setFolders(data.data.folders || []);
          if (data.data.kanbanCols?.length) setKanbanCols(data.data.kanbanCols);
        }
      } catch (err) {
        setLoadError(err.message);
      }
      setLoaded(true);
    })();
  }, []);

  // Save data
  useEffect(() => {
    if (!loaded) return;
    setSyncStatus("saving");
    
    const timer = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        const { error } = await supabase
          .from("user_journals")
          .upsert({
            user_id: session.user.id,
            data: { entries, docs, connections, frames, bgStrokes, kanbanCols , folders },
            updated_at: new Date().toISOString()
          });
          
        if (error) throw error;
        setSyncStatus("synced");
      } catch {
        setSyncStatus("error");
      }
    }, 1200);
    
    return () => clearTimeout(timer);
  }, [entries, docs, connections, frames, bgStrokes, kanbanCols , folders, loaded]);

  const linkMap = processAllLinks(entries, docs);

  const handleSendToCanvas = useCallback((entry) => {
    if (entry.type === "idea" || entry.type === "sketch") {
      updateEntry(entry.id, { archived: false });
    } else {
      addEntry({
        text: entry.text,
        type: "idea",
        tags: entry.tags || [],
        ideaX: 300 + Math.random() * 400,
        ideaY: 200 + Math.random() * 300,
        width: 220,
        height: 160,
        strokes: [],
        archived: false
      });
    }
    setView("ideas");
  }, [addEntry, updateEntry]);

  const handleExport = useCallback(() => {
    let md = "# Interstitial Journal Export\n\n";
    
    md += "## Journal\n\n";
    const grouped = {};
    entries.forEach(e => {
      const date = formatDate(e.ts);
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(e);
    });
    
    Object.entries(grouped).forEach(([date, items]) => {
      md += `### ${date}\n\n`;
      items.forEach(e => {
        md += `${formatTime(e.ts)} - ${e.text}\n\n`;
        if (e.tags?.length) md += `Tags: ${e.tags.join(", ")}\n\n`;
      });
    });
    
    md += "## Docs\n\n";
    docs.forEach(d => {
      md += `### ${d.title || "Untitled"}\n${d.content || ""}\n\n`;
    });
    
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = `journal-${new Date().toISOString().slice(0,10)}.md`;
    a.click();
  }, [entries, docs]);

  if (!loaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", fontFamily: "'Newsreader', serif", color: "var(--text-secondary)" }}>
        <style>{CSS}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>Loading your journal...</div>
          {loadError && <div style={{ color: "var(--red)", fontSize: 14 }}>Error: {loadError}</div>}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="app-container">
        <Nav
          view={view}
          setView={setView}
          syncStatus={syncStatus}
          onExport={handleExport}
          theme={theme}
          setTheme={setTheme}
          onOpenSearch={() => setShowSearch(true)}
          onOpenTimer={() => setShowTimer(s => !s)}
          timerRunning={timerRunning}
        />
        <div className="app-content">
                    <div key={view} className="anim-view" style={{ height: "100%" }}>
            {view === "journal" && (
              <JournalView
                entries={entries} docs={docs} onAddEntry={addEntry} onUpdateEntry={updateEntry} onRemoveEntry={removeEntry} linkMap={linkMap} allTags={allTags}
                openDoc={openDoc} onSendToCanvas={handleSendToCanvas}
              />
            )}
            {view === "kanban" && (
              <KanbanView
                entries={entries} onUpdateEntry={updateEntry} onAddEntry={addEntry}
                allTags={allTags} kanbanCols={kanbanCols} setKanbanCols={setKanbanCols}
              />
            )}
            {view === "ideas" && (
              <IdeasCanvas
                entries={entries} docs={docs} connections={connections} frames={frames} bgStrokes={bgStrokes}
                onAddEntry={addEntry}
                onUpdateEntry={updateEntry} onRemoveEntry={removeEntry} onUpdateDoc={updateDoc} onAddConnection={addConnection} onRemoveConnection={removeConnection}
                onUpdateFrame={updateFrame} onAddFrame={addFrame} onRemoveFrame={removeFrame} onSetBgStrokes={setBgStrokes}
                openDoc={openDoc}
              />
            )}
            {view === "docs" && (
              <DocsView
                docs={docs} entries={entries} allTags={allTags} onAddDoc={addDoc} onUpdateDoc={updateDoc} onDeleteDoc={deleteDoc} onLinkEntry={linkEntryToDoc} onUnlinkEntry={unlinkEntryFromDoc}
                activeDocId={activeDocId} setActiveDocId={setActiveDocId}
                folders={folders} onAddFolder={addFolder} onUpdateFolder={updateFolder} onRemoveFolder={removeFolder}
              />
            )}
          </div>
        </div>
        <MobileNav view={view} setView={setView} />
      </div>
      {showSearch && (
        <GlobalSearch
          entries={entries}
          docs={docs}
          onClose={() => setShowSearch(false)}
          onOpenDoc={openDoc}
          setView={setView}
        />
      )}
      {showTimer && (
        <PomodoroTimer
          onClose={() => setShowTimer(false)}
          onRunningChange={setTimerRunning}
        />
      )}
    </>
  );
}

// ---- Auth Wrapper ----
export default function App() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!authChecked) { return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", color: "var(--text-secondary)" }}>Loading...</div>; }
  if (!session) { return <AuthView />; }

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}