import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = ts => new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
const fmtDate = ts => {
  const d = new Date(ts), today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const INLINE_SEP = "::";
const isInlineId = id => typeof id === "string" && id.includes(INLINE_SEP);
const parseInlineId = id => { const [parentId, li] = id.split(INLINE_SEP); return { parentId, lineIndex: parseInt(li) }; };

const T = {
  note:   { sym: "◦",  label: "Note",   col: "#4a7c59" },
  task:   { sym: "▢",  label: "Task",   col: "#4a6fa5" },
  idea:   { sym: "◈",  label: "Idea",   col: "#b87333" },
  sketch: { sym: "〰", label: "Sketch", col: "#7a5c8a" },
};
const PALETTE  = ["#2c2010","#4a6fa5","#4a7c59","#b87333","#c44a3a","#7a5c8a","#f2ebe0"];
const KB_COLS  = [
  { id: "backlog",     label: "Backlog",     sym: "◎", accent: "#4a6fa5" },
  { id: "in-progress", label: "In Progress", sym: "◐", accent: "#b87333" },
  { id: "done",        label: "Done",        sym: "●", accent: "#4a7c59" },
];
const KB_STATUS = { backlog: { label: "backlog", col: "#4a6fa5" }, "in-progress": { label: "doing", col: "#b87333" }, done: { label: "done", col: "#4a7c59" } };

// ─── Inline Extractions ───────────────────────────────────────────────────────
function extractInlineTasks(entries) {
  const results = [];
  entries.forEach(entry => {
    if (!entry.text || entry.type === "task" || entry.type === "sketch") return;
    entry.text.split("\n").forEach((line, lineIndex) => {
      const m = line.match(/^- \[([ x])\] (.+)$/);
      if (!m) return;
      const done   = m[1] === "x";
      const kanban = entry.inlineTaskKanban?.[lineIndex] ?? (done ? "done" : "backlog");
      const preview = entry.text.split("\n").find(l => l.trim() && !l.match(/^- \[/))?.replace(/^[#◈\-!* ]+/, "").slice(0, 36) || "";
      results.push({
        id: `${entry.id}${INLINE_SEP}${lineIndex}`,
        parentId: entry.id,
        parentType: entry.type,
        lineIndex,
        text: m[2],
        ts: entry.ts,
        done,
        kanban,
        color: entry.color,
        isInline: true,
        preview,
      });
    });
  });
  return results;
}

function extractInlineIdeas(entries) {
  const results = [];
  entries.forEach(entry => {
    if (!entry.text || entry.type === "task" || entry.type === "sketch") return;
    entry.text.split("\n").forEach((line, lineIndex) => {
      const m = line.match(/^(?:-! |◈ )(.+)$/);
      if (!m) return;
      
      const isArchived = !!entry.inlineIdeaArchive?.[lineIndex];
      const pos = entry.inlineIdeaPos?.[lineIndex] || { x: 80 + (lineIndex * 20), y: 80 + (lineIndex * 20), w: 200, h: 140 };
      
      results.push({
        id: `${entry.id}${INLINE_SEP}${lineIndex}`,
        parentId: entry.id,
        parentType: entry.type,
        lineIndex,
        text: m[1],
        type: "idea",
        ts: entry.ts,
        color: entry.color,
        isInline: true,
        archived: isArchived,
        ideaX: pos.x,
        ideaY: pos.y,
        width: pos.w,
        height: pos.h
      });
    });
  });
  return results;
}

// ─── Export ───────────────────────────────────────────────────────────────────
function doExport(entries) {
  const gMap = {}, gOrd = [];
  entries.forEach(e => {
    const k = fmtDate(e.ts);
    if (!gMap[k]) { gMap[k] = []; gOrd.push(k); }
    gMap[k].push(e);
  });
  let md = `# Interstitial Journal\n_Exported ${new Date().toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}_\n\n---\n\n`;
  gOrd.forEach(date => {
    md += `## ${date}\n\n`;
    gMap[date].forEach(e => {
      const sym    = e.type === "task" ? (e.done ? "✓" : "□") : e.type === "idea" ? "◈" : e.type === "sketch" ? "〰" : "◦";
      const status = e.type === "task" ? ` · ${e.done ? "done" : (e.kanban || "backlog")}` : "";
      md += `### ${fmt(e.ts)} ${sym}${status}\n${e.type === "sketch" ? "[Hand-drawn sketch]" : e.text}\n\n`;
    });
  });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([md], { type: "text/markdown" })),
    download: `journal-${new Date().toISOString().slice(0, 10)}.md`,
  });
  a.click();
}

// ─── Markdown engine ──────────────────────────────────────────────────────────
function renderInline(text) {
  if (!text) return null;
  const parts = [];
  let key = 0, lastIndex = 0;
  const re = /(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    if (m[2] !== undefined) parts.push(<strong key={key++}>{m[2]}</strong>);
    else if (m[3] !== undefined) parts.push(<em key={key++}>{m[3]}</em>);
    else if (m[4] !== undefined) parts.push(<code key={key++} className="md-code">{m[4]}</code>);
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : text;
}

function renderMarkdown(text, onToggleTask) {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    if (line.startsWith("## ")) return <div key={i} className="md-h2">{renderInline(line.slice(3))}</div>;
    if (line.startsWith("### ")) return <div key={i} className="md-h3">{renderInline(line.slice(4))}</div>;
    const tm = line.match(/^- \[([ x])\] (.*)$/);
    if (tm) {
      const done = tm[1] === "x";
      return (
        <div key={i} className={`md-task-line${done ? " done" : ""}`} onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={done} readOnly onClick={e => { e.stopPropagation(); onToggleTask && onToggleTask(i); }} />
          <span>{renderInline(tm[2])}</span>
        </div>
      );
    }
    if (line.startsWith("-! ") || line.startsWith("◈ ")) {
      const content = line.startsWith("-! ") ? line.slice(3) : line.slice(2);
      return <div key={i} className="md-idea-line">◈ {renderInline(content)}</div>;
    }
    if (line.startsWith("- ")) return <div key={i} className="md-bullet-line"><span className="md-bsym">•</span><span>{renderInline(line.slice(2))}</span></div>;
    if (line.trim() === "") return <div key={i} className="md-spacer" />;
    return <div key={i} className="md-para">{renderInline(line)}</div>;
  });
}

function applyFormat(type, value, selStart, selEnd) {
  const selected = value.slice(selStart, selEnd);
  const before   = value.slice(0, selStart);
  const after    = value.slice(selEnd);
  let result, ns, ne;

  if (type === "bold") {
    const inner = selected || "bold";
    result = before + `**${inner}**` + after; ns = selStart + 2; ne = ns + inner.length;
  } else if (type === "italic") {
    const inner = selected || "italic";
    result = before + `*${inner}*` + after; ns = selStart + 1; ne = ns + inner.length;
  } else if (type === "code") {
    const inner = selected || "code";
    result = before + "`" + inner + "`" + after; ns = selStart + 1; ne = ns + inner.length;
  } else {
    const lineStart = before.lastIndexOf("\n") + 1;
    const lineText  = value.slice(lineStart);
    const prefixes  = { h2: "## ", h3: "### ", bullet: "- ", task: "- [ ] ", idea: "-! " };
    const pfx       = prefixes[type] || "";
    const hasPfx    = lineText.startsWith(pfx);
    if (hasPfx) {
      result = value.slice(0, lineStart) + value.slice(lineStart + pfx.length);
      ns = Math.max(lineStart, selStart - pfx.length); ne = Math.max(lineStart, selEnd - pfx.length);
    } else {
      result = value.slice(0, lineStart) + pfx + value.slice(lineStart);
      ns = selStart + pfx.length; ne = selEnd + pfx.length;
    }
  }
  return { result, ns, ne };
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');

:root {
  color-scheme: light dark;
  --bg:#f2ebe0; --bg-dot:#bdb3a6;
  --fg:#2c2010; --fg-2:#4a3c2e; --fg-3:#7a6e62; --fg-4:#a09488;
  --border:#d8cfbe; --border-2:#e8e0d4;
  --surf:rgba(255,253,247,0.97); --surf-2:rgba(255,253,247,0.72); --surf-h:rgba(255,253,247,0.65);
  --nav-bg:rgba(242,235,224,0.93);
  --note-1:#fffde8; --note-2:#faf6d0; --note-b:#dfd080; --note-bb:#cec060;
  --shadow:rgba(44,32,16,0.08); --shadow-2:rgba(44,32,16,0.16);
  --input-bg:rgba(255,253,247,0.88);
  --blue:#4a6fa5; --amber:#b87333; --green:#4a7c59;
}
@media(prefers-color-scheme:dark){:root{
  --bg:#1a1612; --bg-dot:#2e2620;
  --fg:#e2d9c8; --fg-2:#c8b898; --fg-3:#8a7e72; --fg-4:#5e5448;
  --border:#3e3428; --border-2:#2e2620;
  --surf:rgba(34,28,20,0.97); --surf-2:rgba(34,28,20,0.72); --surf-h:rgba(44,36,26,0.70);
  --nav-bg:rgba(20,16,10,0.95);
  --note-1:#2e2718; --note-2:#29221a; --note-b:#52452a; --note-bb:#604e30;
  --shadow:rgba(0,0,0,0.28); --shadow-2:rgba(0,0,0,0.45);
  --input-bg:rgba(34,28,20,0.88);
}}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100dvh;min-height:-webkit-fill-available;}
body{background-color:var(--bg);background-image:radial-gradient(circle,var(--bg-dot) 1.2px,transparent 1.2px);background-size:22px 22px;font-family:'Lora',Georgia,serif;color:var(--fg);overflow:hidden;}
.app{height:100dvh;display:flex;flex-direction:column;}

/* Nav */
.nav{position:sticky;top:0;z-index:200;display:flex;align-items:center;gap:4px;padding:10px 24px;background:var(--nav-bg);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--border);}
.logo{font-family:'Caveat',cursive;font-size:22px;font-weight:700;margin-right:auto;color:var(--fg);display:flex;align-items:center;gap:8px;}
.logo-dot{width:8px;height:8px;border-radius:50%;background:var(--fg);flex-shrink:0;}
.nb{font-family:'Caveat',cursive;font-size:16px;padding:5px 18px;border:1.5px solid transparent;border-radius:20px;background:transparent;cursor:pointer;color:var(--fg-3);transition:all 0.15s;}
.nb:hover{color:var(--fg);background:rgba(128,100,60,0.1);}
.nb.act{background:var(--fg);color:var(--bg);}
.nb-badge{display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;border-radius:50%;background:#c44a3a;color:white;font-size:10px;font-family:'Lora',serif;margin-left:4px;vertical-align:middle;}
.nav-btn{font-family:'Caveat',cursive;font-size:15px;padding:5px 14px;border:1.5px solid var(--border);border-radius:20px;background:transparent;cursor:pointer;color:var(--fg-3);transition:all 0.15s;}
.nav-btn:hover{color:var(--fg);background:rgba(128,100,60,0.1);}
.sync{display:flex;align-items:center;gap:6px;margin-left:6px;font-family:'Caveat',cursive;font-size:13px;}
.sync-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;transition:background 0.4s;}
.sync-dot.synced{background:var(--green);} .sync-dot.saving{background:var(--amber);animation:pulse 1.2s ease-in-out infinite;} .sync-dot.error{background:#c44a3a;}
.sync-label.synced{color:var(--green);} .sync-label.saving{color:var(--amber);} .sync-label.error{color:#c44a3a;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}

/* Journal */
.scroll-area{overflow-y:auto;flex:1;display:flex;flex-direction:column;}
.jnl{max-width:700px;margin:0 auto;padding:24px 16px 100px;width:100%;flex:1;}
.cap{background:var(--surf);border:1.5px solid var(--border);border-radius:12px;padding:16px 20px;margin-bottom:16px;box-shadow:0 2px 14px var(--shadow);}
.cap-header{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
.cap-time{font-family:'Caveat',cursive;font-size:15px;color:var(--fg-3);}
.cap-rule{flex:1;height:1px;background:var(--border-2);}
.cap-type-pill{font-family:'Caveat',cursive;font-size:13px;padding:2px 10px;border-radius:12px;background:var(--c);color:white;opacity:0.9;}
.cap-in{width:100%;border:none;outline:none;background:transparent;font-family:'Lora',Georgia,serif;font-size:15px;line-height:1.75;color:var(--fg);resize:none; transition: height 0.1s;}
.cap-in::placeholder{color:var(--fg-4);}
.cap-bot{display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border-2);}
.tbtns{display:flex;gap:6px;flex-wrap:wrap;}
.tb{font-family:'Caveat',cursive;font-size:14px;padding:4px 13px;border:1.5px solid var(--border);border-radius:14px;background:transparent;cursor:pointer;color:var(--fg-3);transition:all 0.15s;}
.tb.ta{background:var(--c);color:white;border-color:var(--c);}
.addb{margin-left:auto;font-family:'Caveat',cursive;font-size:17px;padding:6px 22px;background:var(--fg);color:var(--bg);border:none;border-radius:20px;cursor:pointer;transition:opacity 0.15s;white-space:nowrap;}
.addb:hover{opacity:0.82;} .addb:disabled{opacity:0.28;cursor:default;}

/* Format toolbar */
.fmt-toolbar{display:flex;gap:3px;align-items:center;padding:6px 0 8px;border-bottom:1px solid var(--border-2);margin-bottom:8px;flex-wrap:wrap;}
.fmt-btn{font-size:12px;padding:3px 7px;border:1px solid var(--border);border-radius:5px;background:transparent;cursor:pointer;color:var(--fg-3);transition:all 0.13s;font-family:'Lora',serif;min-width:26px;text-align:center;}
.fmt-btn:hover{color:var(--fg);background:rgba(128,100,60,0.1);border-color:var(--fg-3);}
.fmt-sep{width:1px;height:14px;background:var(--border);margin:0 3px;flex-shrink:0;}
.fmt-idea-btn{color:var(--amber) !important;border-color:var(--amber) !important;}
.fmt-idea-btn:hover{background:rgba(184,115,51,0.1) !important;}
.fmt-task-btn{color:var(--blue) !important;border-color:var(--blue) !important;}
.fmt-task-btn:hover{background:rgba(74,111,165,0.1) !important;}

/* Search + date jump */
.search-row{display:flex;gap:8px;margin-bottom:16px;}
.search-wrap{position:relative;flex:1;}
.search-in{width:100%;padding:9px 36px 9px 38px;border:1.5px solid var(--border);border-radius:8px;background:var(--input-bg);font-family:'Lora',serif;font-size:14px;color:var(--fg);outline:none;transition:border-color 0.15s;}
.search-in:focus{border-color:var(--blue);}
.search-in::placeholder{color:var(--fg-4);}
.search-icon{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--fg-4);font-size:14px;pointer-events:none;font-family:'Caveat',cursive;}
.search-clear{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--fg-4);font-size:18px;cursor:pointer;padding:0 4px;line-height:1;}
.search-clear:hover{color:var(--fg);}
.date-jump{position:relative;flex-shrink:0;}
.date-jump-btn{font-family:'Caveat',cursive;font-size:15px;padding:9px 14px;border:1.5px solid var(--border);border-radius:8px;background:var(--input-bg);cursor:pointer;color:var(--fg-3);transition:all 0.15s;white-space:nowrap;}
.date-jump-btn:hover{color:var(--fg);border-color:var(--fg-3);}
.date-jump-menu{position:absolute;top:calc(100% + 4px);right:0;background:var(--surf);border:1px solid var(--border);border-radius:10px;padding:4px;min-width:180px;z-index:100;box-shadow:0 6px 20px var(--shadow-2);max-height:260px;overflow-y:auto;}
.date-jump-item{font-family:'Caveat',cursive;font-size:15px;padding:8px 12px;border-radius:6px;cursor:pointer;color:var(--fg-2);display:flex;justify-content:space-between;align-items:center;}
.date-jump-item:hover{background:rgba(128,100,60,0.1);}
.date-jump-count{font-family:'Lora',serif;font-size:12px;color:var(--fg-4);}

/* Entry list */
.emp{text-align:center;font-family:'Caveat',cursive;font-size:20px;color:var(--fg-4);padding:60px 0;line-height:2;}
.dlbl{font-family:'Caveat',cursive;font-size:20px;font-weight:600;color:var(--fg-2);padding:28px 0 8px;display:flex;align-items:center;gap:10px;letter-spacing:0.2px;}
.dlbl::after{content:'';flex:1;height:1.5px;background:var(--border);border-radius:1px;}
.ent{display:flex;align-items:flex-start;gap:10px;padding:12px 18px 12px 8px;border-bottom:1px solid rgba(128,100,60,0.1);position:relative;border-radius:6px;margin:0 -8px;transition:background 0.12s;overflow:hidden;}
.ent:hover{background:var(--surf-h);}
.ent:hover .eedit,.ent:hover .edel{opacity:1;}
.et{font-family:'Caveat',cursive;font-size:14px;color:var(--fg-2);min-width:40px;padding-top:3px;flex-shrink:0;font-weight:600;}
.etyp{background:none;border:none;cursor:pointer;font-size:17px;line-height:1;padding:1px 2px;min-width:22px;transition:transform 0.12s;flex-shrink:0;}
.etyp:hover{transform:scale(1.35) rotate(15deg);}
.tck{margin-top:4px;width:15px;height:15px;cursor:pointer;accent-color:var(--blue);flex-shrink:0;}
.task-status{font-family:'Caveat',cursive;font-size:11px;padding:1px 7px;border-radius:10px;cursor:pointer;flex-shrink:0;margin-top:4px;border:1px solid transparent;transition:all 0.15s;background:rgba(74,111,165,0.1);color:var(--blue);border-color:rgba(74,111,165,0.25);}
.task-status.in-progress{background:rgba(184,115,51,0.1);color:var(--amber);border-color:rgba(184,115,51,0.25);}
.task-status.done{background:rgba(74,124,89,0.1);color:var(--green);border-color:rgba(74,124,89,0.25);}
.task-status:hover{filter:saturate(1.4);}
.etxt-wrap{flex:1;min-width:0;}
.etxt{font-family:'Lora',Georgia,serif;font-size:15px;line-height:1.68;color:var(--fg);word-break:break-word;display:block;cursor:text;}
.etxt.dn{text-decoration:line-through;color:var(--fg-4);}
.edit-ta{width:100%;border:none;outline:none;background:transparent;font-family:'Lora',Georgia,serif;font-size:15px;line-height:1.68;color:var(--fg);resize:none;border-bottom:1.5px solid var(--blue);padding-bottom:2px;}
.edit-hint{font-family:'Caveat',cursive;font-size:12px;color:var(--fg-4);margin-top:4px;}
.cpicker{display:flex;gap:5px;align-items:center;padding:5px 0 2px;flex-wrap:wrap;}
.cp-dot{width:16px;height:16px;border-radius:50%;background:var(--h);border:2px solid transparent;cursor:pointer;transition:transform 0.12s;padding:0;}
.cp-dot:hover{transform:scale(1.3);}
.cp-dot.cpa{border-color:var(--fg);}
.cp-clear{font-size:12px;color:var(--fg-3);background:none;border:1.5px solid var(--border);border-radius:10px;padding:1px 8px;cursor:pointer;font-family:'Lora',serif;}
.cp-clear:hover{color:#c44a3a;border-color:#c44a3a;}
.eedit{background:none;border:none;color:var(--fg-3);font-size:14px;cursor:pointer;opacity:0;padding:0 3px;transition:opacity 0.15s,color 0.12s;line-height:1;flex-shrink:0;}
.eedit:hover{color:var(--blue);}
.edel{background:none;border:none;color:#b85040;font-size:18px;cursor:pointer;opacity:0;padding:0 3px;transition:opacity 0.15s;line-height:1;flex-shrink:0;}
.entry-ribbon{position:absolute;right:0;top:3px;bottom:3px;width:4px;border-radius:3px;cursor:pointer;transition:width 0.15s,opacity 0.2s;opacity:0.75;}
.entry-ribbon:hover{width:6px;opacity:1;}
.entry-ribbon.no-color{opacity:0;background:var(--border);}
.ent:hover .entry-ribbon.no-color{opacity:0.4;}

/* Markdown */
.md-content{font-family:'Lora',serif;font-size:15px;line-height:1.7;color:var(--fg);}
.md-h2{font-family:'Caveat',cursive;font-size:20px;font-weight:700;color:var(--fg-2);margin:6px 0 2px;line-height:1.3;}
.md-h3{font-family:'Caveat',cursive;font-size:17px;font-weight:600;color:var(--fg-2);margin:4px 0 1px;line-height:1.4;}
.md-para{margin:1px 0;word-break:break-word;}
.md-spacer{height:6px;}
.md-bullet-line{display:flex;gap:8px;align-items:flex-start;margin:2px 0;}
.md-bsym{color:var(--fg-3);flex-shrink:0;margin-top:1px;font-size:14px;}
.md-task-line{display:flex;gap:7px;align-items:flex-start;margin:3px 0;}
.md-task-line input[type=checkbox]{margin-top:4px;accent-color:var(--blue);flex-shrink:0;cursor:pointer;}
.md-task-line.done>span{text-decoration:line-through;color:var(--fg-4);}
.md-idea-line{background:rgba(184,115,51,0.08);border-left:3px solid var(--amber);padding:3px 8px;margin:3px 0;border-radius:0 4px 4px 0;color:var(--fg);word-break:break-word;}
@media(prefers-color-scheme:dark){.md-idea-line{background:rgba(184,115,51,0.13);}}
.md-code{font-family:'Courier New',monospace;background:rgba(128,100,60,0.12);padding:1px 5px;border-radius:3px;font-size:13px;color:var(--fg);}

/* Kanban */
.kb-wrap{display:flex;flex-direction:column;flex:1;overflow:hidden;}
.kb-add-row{padding:16px 20px 0;}
.kb-add-in{width:100%;max-width:400px;padding:9px 16px;border:1.5px solid var(--border);border-radius:8px;background:var(--input-bg);font-family:'Lora',serif;font-size:14px;color:var(--fg);outline:none;transition:border-color 0.15s;}
.kb-add-in:focus{border-color:var(--blue);}
.kb-add-in::placeholder{color:var(--fg-4);}
.kb{display:flex;gap:14px;padding:16px 20px 20px;flex:1;align-items:stretch;overflow-x:auto;}
.kc{flex:1;min-width:240px;background:var(--surf-2);border:1px solid var(--border);border-radius:12px;display:flex;flex-direction:column;overflow:hidden;position:relative;transition:border-color 0.15s,box-shadow 0.15s;}
.kc.ko{border-color:var(--blue);box-shadow:0 0 0 2px rgba(74,111,165,0.18);}
.kc-top{height:3px;flex-shrink:0;border-radius:12px 12px 0 0;}
.kc-header{padding:14px 16px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border-2);}
.kc-sym{font-size:13px;color:var(--fg-3);}
.kc-title{font-family:'Caveat',cursive;font-size:20px;font-weight:700;color:var(--fg);flex:1;}
.kc-count{font-family:'Lora',serif;font-size:12px;color:var(--fg-3);background:var(--border-2);padding:2px 9px;border-radius:10px;min-width:24px;text-align:center;}
.kc-body{flex:1;padding:10px 12px 12px;overflow-y:auto;}
.kcard{background:var(--surf);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:8px;cursor:grab;transition:box-shadow 0.15s,transform 0.12s,opacity 0.15s;position:relative;overflow:hidden;}
.kcard::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--kc-accent,var(--blue));border-radius:8px 0 0 8px;}
.kcard:hover{box-shadow:0 4px 16px var(--shadow-2);transform:translateY(-1px);}
.kcard:hover .k-edit-btn{opacity:1;}
.kcard.kdr{opacity:0.38;cursor:grabbing;transform:rotate(1.5deg);box-shadow:0 8px 24px var(--shadow-2);}
.kcard.kdone{opacity:0.72;}
.kcard.kdone::before{background:var(--green);}
.kcard.kdone .kct2{text-decoration:line-through;color:var(--fg-3);}
.kct2{font-family:'Lora',Georgia,serif;font-size:14px;line-height:1.55;color:var(--fg);cursor:text;}
.k-edit-ta{width:100%;border:none;outline:none;background:transparent;font-family:'Lora',Georgia,serif;font-size:14px;line-height:1.55;color:var(--fg);resize:none;border-bottom:1.5px solid var(--blue);}
.kcard-foot{display:flex;align-items:center;justify-content:space-between;margin-top:8px;}
.ktm{font-family:'Caveat',cursive;font-size:12px;color:var(--fg-4);}
.k-edit-btn{background:none;border:none;color:var(--fg-3);font-size:13px;cursor:pointer;padding:0 3px;opacity:0;transition:color 0.12s,opacity 0.15s;}
.k-edit-btn:hover{color:var(--blue);}
.kemp{font-family:'Caveat',cursive;font-size:15px;color:var(--fg-4);text-align:center;padding:28px 0;border:1.5px dashed var(--border);border-radius:8px;margin:4px 0;}

/* Ideas canvas */
.ic-viewport{position:relative;width:100%;flex:1;overflow:hidden;user-select:none;touch-action:none;}
.ic-canvas{position:absolute;top:0;left:0;width:100vw;height:100vh;transform-origin:0 0;}
.ic-empty{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;font-family:'Caveat',cursive;font-size:20px;color:var(--fg-4);pointer-events:none;line-height:2.4;}
.ic-empty-sym{font-size:44px;color:var(--border);margin-bottom:8px;}
.ic-nav-hint{position:absolute;bottom:90px;left:50%;transform:translateX(-50%);font-family:'Caveat',cursive;font-size:13px;color:var(--fg-4);pointer-events:none;white-space:nowrap;background:var(--nav-bg);backdrop-filter:blur(10px);padding:5px 14px;border-radius:20px;border:1px solid var(--border);}

.mobile-quick-add { display: none; }
.floating-dock{position:absolute;bottom:28px;left:50%;transform:translateX(-50%);display:flex;gap:3px;align-items:center;background:var(--nav-bg);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);padding:6px 8px;border-radius:28px;border:1px solid var(--border);z-index:200;box-shadow:0 4px 24px var(--shadow-2);}
.dock-btn{font-family:'Caveat',cursive;font-size:16px;padding:6px 12px;border:none;border-radius:18px;background:transparent;cursor:pointer;color:var(--fg-3);transition:all 0.15s;display:flex;align-items:center;gap:5px;}
.dock-btn:hover{color:var(--fg);background:rgba(128,100,60,0.1);}
.dock-btn.active{background:var(--fg);color:var(--bg);}
.dock-sep{width:1px;height:20px;background:var(--border);margin:0 2px;flex-shrink:0;}
.quick-add-wrap{border-right:1px solid var(--border);padding-right:8px;margin-right:2px;}
.quick-add-in{border:none;background:transparent;outline:none;font-family:'Lora',serif;font-size:14px;color:var(--fg);width:120px;padding:4px 8px;}
.quick-add-in::placeholder{color:var(--fg-4);}
.dock-cpicker{margin-left:4px;}

.inote{position:absolute;background:linear-gradient(160deg,var(--note-1) 0%,var(--note-2) 100%);border:1px solid var(--note-b);border-bottom:3px solid var(--note-bb);border-radius:3px;padding:20px 14px 10px;box-shadow:2px 3px 12px var(--shadow);transition:box-shadow 0.15s;}
.inote:hover{box-shadow:4px 6px 20px var(--shadow-2);}
.inote.idr{z-index:100 !important;box-shadow:6px 10px 28px var(--shadow-2);transform:rotate(1deg);}
.inote.isel{border-color:var(--amber);box-shadow:0 0 0 2.5px rgba(184,115,51,0.4);}
.inote-pin{position:absolute;top:-10px;left:50%;transform:translateX(-50%);width:16px;height:16px;border-radius:50%;background:var(--amber);border:2.5px solid var(--bg);box-shadow:0 2px 5px var(--shadow-2);}
.inote-pin.sketch-pin{background:#7a5c8a;}
.intxt{font-family:'Lora',Georgia,serif;font-size:13.5px;line-height:1.65;color:var(--fg);overflow:hidden;}
.idea-edit-ta{width:100%;border:none;outline:none;background:transparent;font-family:'Lora',Georgia,serif;font-size:13.5px;line-height:1.65;color:var(--fg);resize:none;border-bottom:1.5px solid var(--amber);}
.intm-row{display:flex;align-items:center;justify-content:space-between;margin-top:10px;border-top:1px solid var(--note-b);padding-top:7px;}
.intm{font-family:'Caveat',cursive;font-size:12px;color:var(--fg-3);}
.inote-actions{display:flex;gap:2px;}
.inote-action{background:none;border:none;font-family:'Lora',serif;font-size:12px;cursor:pointer;padding:2px 7px;border-radius:5px;color:var(--fg-4);line-height:1.5;transition:color 0.12s,background 0.12s;}
.inote-action:hover{color:var(--fg);background:rgba(128,100,60,0.12);}
.inote-action.danger:hover{color:#c44a3a;background:rgba(196,74,58,0.1);}
.sketch-toolbar{position:absolute;bottom:-46px;right:0;z-index:100;display:flex;gap:5px;align-items:center;background:var(--surf);border:1px solid var(--border);padding:5px 8px;border-radius:12px;box-shadow:0 3px 12px var(--shadow-2);}
.sketch-tool-btn{font-family:'Caveat',cursive;font-size:14px;padding:3px 10px;border:1.5px solid var(--border);border-radius:10px;background:transparent;cursor:pointer;color:var(--fg-3);transition:all 0.13s;}
.sketch-tool-btn.sact{background:var(--fg);color:var(--bg);border-color:var(--fg);}
.sketch-tool-btn.done-btn{background:#7a5c8a;color:#fff;border-color:#7a5c8a;}
.sketch-tool-btn.done-btn:hover{opacity:0.85;}
.resize-handle{position:absolute;bottom:0;right:0;width:18px;height:18px;cursor:nwse-resize;opacity:0.2;transition:opacity 0.15s;}
.inote:hover .resize-handle{opacity:0.5;}
.archive-panel{position:absolute;right:0;top:0;bottom:0;width:270px;background:var(--nav-bg);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-left:1px solid var(--border);z-index:150;display:flex;flex-direction:column;box-shadow:-4px 0 20px var(--shadow);}
.archive-panel-hd{padding:16px;border-bottom:1px solid var(--border);font-family:'Caveat',cursive;font-size:18px;color:var(--fg);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;}
.archive-close{background:none;border:none;font-size:20px;color:var(--fg-3);cursor:pointer;line-height:1;padding:0 4px;}
.archive-close:hover{color:var(--fg);}
.archive-scroll{overflow-y:auto;flex:1;}
.archive-empty{padding:20px;font-family:'Caveat',cursive;font-size:16px;color:var(--fg-4);text-align:center;line-height:2;}
.archive-item{padding:12px 14px;border-bottom:1px solid var(--border-2);display:flex;flex-direction:column;gap:6px;}
.archive-item-text{font-family:'Lora',serif;font-size:13px;color:var(--fg-3);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
.archive-item-foot{display:flex;gap:4px;align-items:center;}
.archive-item-ts{font-family:'Caveat',cursive;font-size:11px;color:var(--fg-4);flex:1;}
.archive-action{background:none;border:1px solid var(--border);font-size:12px;cursor:pointer;color:var(--fg-3);padding:2px 8px;border-radius:5px;font-family:'Lora',serif;transition:all 0.13s;}
.archive-action:hover{color:var(--fg);border-color:var(--fg-3);}
.archive-action.del:hover{color:#c44a3a;border-color:#c44a3a;}

/* Auth + loading */
.auth-container{min-height:100dvh;display:flex;align-items:center;justify-content:center;background-color:var(--bg);background-image:radial-gradient(circle,var(--bg-dot) 1.2px,transparent 1.2px);background-size:22px 22px;}
.auth-box{background:var(--surf);border:1.5px solid var(--border);border-radius:16px;padding:40px;width:100%;max-width:340px;box-shadow:0 8px 40px var(--shadow-2);}
.auth-title{font-family:'Caveat',cursive;font-size:34px;font-weight:700;color:var(--fg);text-align:center;margin-bottom:28px;display:flex;align-items:center;justify-content:center;gap:10px;}
.auth-input{width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;background:var(--input-bg);font-family:'Lora',serif;font-size:14px;color:var(--fg);outline:none;margin-bottom:12px;display:block;transition:border-color 0.15s;}
.auth-input:focus{border-color:var(--blue);} .auth-input::placeholder{color:var(--fg-4);}
.auth-btn{width:100%;padding:10px;background:var(--fg);color:var(--bg);font-family:'Caveat',cursive;font-size:18px;border:none;border-radius:8px;cursor:pointer;margin-top:4px;transition:opacity 0.15s;}
.auth-btn:hover{opacity:0.85;} .auth-btn:disabled{opacity:0.4;cursor:default;}
.auth-switch{background:none;border:none;color:var(--fg-3);font-family:'Lora',serif;font-size:13px;cursor:pointer;width:100%;text-align:center;margin-top:16px;text-decoration:underline;}
.loading{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;height:100dvh;font-family:'Caveat',cursive;font-size:24px;color:var(--fg-3);background-color:var(--bg);background-image:radial-gradient(circle,var(--bg-dot) 1.2px,transparent 1.2px);background-size:22px 22px;}
.load-err{font-size:15px;color:#c44a3a;font-family:'Lora',serif;max-width:380px;text-align:center;line-height:1.7;background:rgba(196,74,58,0.1);padding:12px 20px;border-radius:8px;border:1px solid rgba(196,74,58,0.3);}

/* Mobile nav components — hidden on desktop */
.mob-nav { display:none; }
.nav-overflow { display:none; position:relative; flex-shrink:0; }
.nav-overflow-btn { background:none; border:1.5px solid var(--border); color:var(--fg-3); font-size:16px; cursor:pointer; padding:4px 10px; border-radius:20px; line-height:1; transition:all 0.15s; letter-spacing:2px; }
.nav-overflow-btn:hover { color:var(--fg); border-color:var(--fg-3); }
.nav-overflow-menu { position:absolute; top:calc(100% + 8px); right:0; background:var(--surf); border:1px solid var(--border); border-radius:10px; padding:4px; min-width:140px; z-index:400; box-shadow:0 6px 20px var(--shadow-2); }
.nav-overflow-item { font-family:'Caveat',cursive; font-size:17px; padding:10px 14px; border-radius:6px; cursor:pointer; color:var(--fg-2); display:flex; align-items:center; gap:8px; background:none; border:none; width:100%; text-align:left; }
.nav-overflow-item:hover { background:rgba(128,100,60,0.1); }
.nav-overflow-item.danger { color:#c44a3a; }
.nav-overflow-item.danger:hover { background:rgba(196,74,58,0.08); }

@media(max-width:640px){
  .nav .nb, .nav .nav-btn { display:none; }
  .nav-overflow { display:block; }
  .nav { padding:10px 14px; }
  .logo { font-size:19px; }
  .sync-label { display:none; }
  .mob-nav { display:flex; position:fixed; bottom:22px; left:50%; transform:translateX(-50%); z-index:300; background:var(--nav-bg); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); border:1px solid var(--border); border-radius:32px; padding:6px 8px; gap:2px; box-shadow:0 6px 28px var(--shadow-2); }
  .mob-nb { display:flex; flex-direction:column; align-items:center; gap:3px; padding:9px 24px; border:none; border-radius:24px; background:transparent; cursor:pointer; color:var(--fg-3); transition:all 0.15s; position:relative; font-family:'Caveat',cursive; }
  .mob-nb:hover { color:var(--fg); background:rgba(128,100,60,0.1); }
  .mob-nb.act { background:var(--fg); color:var(--bg); }
  .mob-nb-sym { font-size:19px; line-height:1; }
  .mob-nb-lbl { font-size:11px; line-height:1; opacity:0.85; }
  .mob-nb .nb-badge { position:absolute; top:5px; right:9px; width:15px; height:15px; font-size:9px; }
  .jnl { padding-bottom:130px; }
  
  /* Kanban Swipe Layout */
  .kb { flex-direction:row; overflow-x:auto; scroll-snap-type:x mandatory; padding:12px 16px 100px; gap:16px; scroll-padding:16px; }
  .kc { min-width:85vw; scroll-snap-align:start; }

  /* Ideas Mobile Toolbar */
  .quick-add-wrap { display: none; }
  .mobile-quick-add { display: block; position: absolute; top: 16px; left: 50%; transform: translateX(-50%); background: var(--nav-bg); padding: 4px 12px; border-radius: 20px; border: 1px solid var(--border); box-shadow: 0 4px 12px var(--shadow-2); z-index: 200; }
  .mobile-quick-add .quick-add-in { width: 140px; font-size: 14px; }
  .floating-dock { top: 50%; bottom: auto; right: 12px; left: auto; transform: translateY(-50%); flex-direction: column; padding: 8px 4px; border-radius: 24px; gap: 8px; width: 46px; }
  .dock-sep { width: 24px; height: 1px; margin: 2px auto; }
  .dock-btn { padding: 0; justify-content: center; width: 34px; height: 34px; border-radius: 50%; }
  .dock-btn .dock-lbl { display: none; }
  .dock-cpicker { margin-left: 0; margin-top: 4px; flex-direction: column; }
  .ic-nav-hint { display: none; } /* Clear screen clutter on mobile */
  .archive-panel { width:100%; top:auto; height:60%; border-left:none; border-top:1px solid var(--border); }
}
`;

// ─── FreehandArea ─────────────────────────────────────────────────────────────
function FreehandArea({ strokes = [], onStrokesChange, active, style, drawColor = "#2c2010", tool = "draw", camScale = 1 }) {
  const [cur, setCur] = useState(null);
  const getP  = e => { const r = e.currentTarget.getBoundingClientRect(); return [(e.clientX-r.left)/camScale, (e.clientY-r.top)/camScale]; };
  const erase = ([px,py]) => { const f=strokes.filter(s=>{const p=Array.isArray(s)?s:s.points;return!p.some(pt=>Math.hypot(pt[0]-px,pt[1]-py)<15);}); if(f.length!==strokes.length)onStrokesChange(f); };
  const pd    = pts => pts&&pts.length?"M "+pts.map(p=>`${p[0]},${p[1]}`).join(" L "):"";
  return (
    <svg style={{width:'100%',height:'100%',touchAction:'none',pointerEvents:active?'all':'none',cursor:tool==='erase'?'cell':'crosshair',...style}}
      onPointerDown={e=>{if(!active||e.button===2)return;e.currentTarget.setPointerCapture(e.pointerId);tool==='draw'?setCur({color:drawColor,points:[getP(e)]}):erase(getP(e));}}
      onPointerMove={e=>{if(!active)return;tool==='draw'&&cur?setCur({...cur,points:[...cur.points,getP(e)]}):tool==='erase'&&e.buttons===1&&erase(getP(e));}}
      onPointerUp={()=>{if(tool==='draw'&&cur){onStrokesChange([...strokes,cur]);setCur(null);}}}
      onPointerCancel={()=>setCur(null)}>
      {strokes.map((s,i)=>{const p=Array.isArray(s)?s:s.points;return <path key={i} d={pd(p)} fill="none" stroke={s.color||drawColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>;  })}
      {cur&&<path d={pd(cur.points)} fill="none" stroke={cur.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>}
    </svg>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ view, setView, pendingCount, onExport, sync, onLogout }) {
  const [showMenu, setShowMenu] = useState(false);
  const labels = { synced:"synced", saving:"saving…", error:"error" };
  return (
    <nav className="nav" onClick={()=>setShowMenu(false)}>
      <span className="logo"><span className="logo-dot"/>interstitial</span>
      {[["journal","◎ journal"],["kanban","⊞ tasks"],["ideas","◈ ideas"]].map(([v,label])=>(
        <button key={v} className={`nb ${view===v?"act":""}`} onClick={()=>setView(v)}>
          {label}{v==="kanban"&&pendingCount>0&&<span className="nb-badge">{pendingCount}</span>}
        </button>
      ))}
      <button className="nav-btn" onClick={onExport}>↓ export</button>
      <button className="nav-btn" onClick={onLogout}>logout</button>
      <div className="nav-overflow" onClick={e=>e.stopPropagation()}>
        <button className="nav-overflow-btn" onClick={()=>setShowMenu(m=>!m)}>···</button>
        {showMenu&&(
          <div className="nav-overflow-menu">
            <button className="nav-overflow-item" onClick={()=>{onExport();setShowMenu(false);}}>↓ export</button>
            <button className="nav-overflow-item danger" onClick={()=>{onLogout();setShowMenu(false);}}>logout</button>
          </div>
        )}
      </div>
      <span className="sync" style={{marginLeft:"auto"}}><span className={`sync-dot ${sync}`}/><span className={`sync-label ${sync}`}>{labels[sync]}</span></span>
    </nav>
  );
}

// ─── Mobile Bottom Nav ────────────────────────────────────────────────────────
function MobileBottomNav({ view, setView, pendingCount }) {
  return (
    <nav className="mob-nav">
      {[["journal","◎","journal"],["kanban","⊞","tasks"],["ideas","◈","ideas"]].map(([v,sym,label])=>(
        <button key={v} className={`mob-nb ${view===v?"act":""}`} onClick={()=>setView(v)}>
          <span className="mob-nb-sym">{sym}</span>
          <span className="mob-nb-lbl">{label}</span>
          {v==="kanban"&&pendingCount>0&&<span className="nb-badge">{pendingCount}</span>}
        </button>
      ))}
    </nav>
  );
}

function FormatToolbar({ value, onChange, textareaRef }) {
  const apply = type => {
    const ta = textareaRef.current; if (!ta) return;
    const { result, ns, ne } = applyFormat(type, value, ta.selectionStart, ta.selectionEnd);
    onChange(result);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(ns, ne); });
  };
  const Btn = ({ t, ch, title, cls="" }) => <button type="button" className={`fmt-btn ${cls}`} onClick={()=>apply(t)} title={title}>{ch}</button>;
  return (
    <div className="fmt-toolbar">
      <Btn t="bold"   ch={<strong>B</strong>} title="Bold (**text**)" />
      <Btn t="italic" ch={<em>I</em>}         title="Italic (*text*)" />
      <Btn t="code"   ch={<code style={{fontSize:10}}>{"<>"}</code>} title="Code (`text`)" />
      <div className="fmt-sep"/>
      <Btn t="h2"     ch="H"                  title="Heading (## )" />
      <Btn t="h3"     ch="h"                  title="Subheading (### )" />
      <Btn t="bullet" ch="•"                  title="Bullet (- )" />
      <div className="fmt-sep"/>
      <Btn t="task"   ch="☐"  cls="fmt-task-btn" title="Inline task (- [ ] )" />
      <Btn t="idea"   ch="◈"  cls="fmt-idea-btn" title="Inline idea (-! ) — renders as ◈" />
    </div>
  );
}

// ─── Journal ──────────────────────────────────────────────────────────────────
function Journal({ entries, input, setInput, inputType, setInputType, addEntry, update, remove }) {
  const [now,setNow]             = useState(Date.now());
  const [editingId,setEditingId] = useState(null);
  const [editingText,setEditingText] = useState("");
  const [colorPickerId,setColorPickerId] = useState(null);
  const [search,setSearch]       = useState("");
  const [showDateMenu,setShowDateMenu] = useState(false);
  const editRef    = useRef(null);
  const capRef     = useRef(null);
  const dateRefs   = useRef({});

  useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()),30000); return()=>clearInterval(t); },[]);
  useEffect(()=>{ if(editingId&&editRef.current){editRef.current.focus();editRef.current.select();} },[editingId]);

  const startEdit = e => { setEditingId(e.id); setEditingText(e.text||""); setColorPickerId(null); };
  const saveEdit  = id => { if(editingText.trim())update(id,{text:editingText.trim()}); setEditingId(null); };
  const editKey   = (ev,id) => { if(ev.key==="Escape"){setEditingId(null);return;} if(ev.key==="Enter"&&(ev.metaKey||ev.ctrlKey)){ev.preventDefault();saveEdit(id);} };

  const toggleInlineTask = (entryId, lineIdx, text) => {
    const entry = entries.find(e => e.id === entryId);
    const lines = text.split("\n"), l = lines[lineIdx];
    let newKanban;
    if (l.startsWith("- [ ] ")) { lines[lineIdx] = l.replace("- [ ] ","- [x] "); newKanban = "done"; }
    else if (l.startsWith("- [x] ")) { lines[lineIdx] = l.replace("- [x] ","- [ ] "); newKanban = "backlog"; }
    const inlineTaskKanban = { ...(entry?.inlineTaskKanban||{}), [lineIdx]: newKanban };
    update(entryId, { text: lines.join("\n"), inlineTaskKanban });
  };

  const cycleKanban = e => {
    const s=["backlog","in-progress","done"];
    const next=s[(s.indexOf(e.kanban||"backlog")+1)%s.length];
    update(e.id,{kanban:next,done:next==="done"});
  };

  const filtered = search.trim() ? entries.filter(e=>e.text&&e.text.toLowerCase().includes(search.toLowerCase())) : entries;
  const gMap={},gOrd=[];
  filtered.forEach(e=>{ const k=fmtDate(e.ts); if(!gMap[k]){gMap[k]=[];gOrd.push(k);} gMap[k].push(e); });

  const journalTypes = Object.entries(T).filter(([k])=>k!=="sketch");
  const cycleType = cur => { const ts=["note","task","idea"]; return ts[(ts.indexOf(cur)+1)%ts.length]; };
  const jumpToDate = date => { dateRefs.current[date]?.scrollIntoView({behavior:"smooth",block:"start"}); setShowDateMenu(false); };

  const dynRows = Math.min(12, Math.max(3, input.split("\n").length));

  return (
    <div className="scroll-area" onClick={()=>{ setColorPickerId(null); setShowDateMenu(false); }}>
      <div className="jnl">
        <div className="cap">
          <div className="cap-header">
            <span className="cap-time">{fmt(now)}</span>
            <div className="cap-rule"/>
            <span className="cap-type-pill" style={{"--c":T[inputType].col}}>{T[inputType].sym} {T[inputType].label}</span>
          </div>
          <FormatToolbar value={input} onChange={setInput} textareaRef={capRef}/>
          <textarea ref={capRef} className="cap-in" placeholder="What's on your mind? (⌘+Enter to save)" value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if((e.metaKey||e.ctrlKey)&&e.key==="Enter"){e.preventDefault();addEntry();} }}
            rows={dynRows} autoFocus/>
          <div className="cap-bot">
            <div className="tbtns">
              {journalTypes.map(([type,{sym,label,col}])=>(
                <button key={type} className={`tb ${inputType===type?"ta":""}`} style={{"--c":col}} onClick={()=>setInputType(type)}>{sym} {label}</button>
              ))}
            </div>
            <button className="addb" onClick={addEntry} disabled={!input.trim()}>Add →</button>
          </div>
        </div>

        <div className="search-row" onClick={e=>e.stopPropagation()}>
          <div className="search-wrap">
            <span className="search-icon">◎</span>
            <input className="search-in" placeholder="Search entries…" value={search} onChange={e=>setSearch(e.target.value)}/>
            {search&&<button className="search-clear" onClick={()=>setSearch("")}>×</button>}
          </div>
          {gOrd.length>0&&(
            <div className="date-jump">
              <button className="date-jump-btn" onClick={e=>{e.stopPropagation();setShowDateMenu(d=>!d);}}>◎ jump</button>
              {showDateMenu&&(
                <div className="date-jump-menu" onClick={e=>e.stopPropagation()}>
                  {gOrd.map(date=>(
                    <div key={date} className="date-jump-item" onClick={()=>jumpToDate(date)}>
                      <span>{date}</span><span className="date-jump-count">{gMap[date].length}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {gOrd.length===0 ? (
          <div className="emp">
            {search?<div>No results for "{search}"</div>:<><div style={{fontSize:36,marginBottom:12}}>◎</div><div>Nothing yet — capture your first thought above.</div><div style={{fontSize:14,marginTop:8,color:"var(--fg-4)"}}>Use **bold**, *italic*, ## headings, - [ ] tasks, -! ideas</div></>}
          </div>
        ) : gOrd.map(date=>(
          <div key={date}>
            <div className="dlbl" ref={el=>dateRefs.current[date]=el}>{date}</div>
            {gMap[date].map(e=>(
              <div key={e.id} className="ent">
                <span className="et">{fmt(e.ts)}</span>
                <button className="etyp" style={{color:T[e.type]?.col||"#888"}}
                  onClick={()=>e.type!=="sketch"&&update(e.id,{type:cycleType(e.type)})}
                  disabled={e.type==="sketch"} title={e.type==="sketch"?"Sketch":"Change type"}>
                  {T[e.type]?.sym||"◦"}
                </button>
                {e.type==="task"&&(
                  <>
                    <input type="checkbox" className="tck" checked={!!e.done}
                      onChange={ev=>update(e.id,{done:ev.target.checked,kanban:ev.target.checked?"done":(e.kanban==="done"?"backlog":e.kanban)})}/>
                    <button className={`task-status ${e.kanban||"backlog"}`} onClick={ev=>{ev.stopPropagation();cycleKanban(e);}} title="Cycle kanban status">
                      {KB_STATUS[e.kanban||"backlog"]?.label}
                    </button>
                  </>
                )}
                <div className="etxt-wrap" onClick={ev=>ev.stopPropagation()}>
                  {editingId===e.id ? (
                    <div>
                      <textarea ref={editRef} className="edit-ta" value={editingText}
                        rows={Math.max(3,editingText.split("\n").length)}
                        onChange={ev=>setEditingText(ev.target.value)}
                        onKeyDown={ev=>editKey(ev,e.id)}
                        onBlur={()=>saveEdit(e.id)}/>
                      <div className="edit-hint">⌘+Enter to save · Esc to cancel · markdown: **bold** *italic* ## H -[ ] task -! idea</div>
                    </div>
                  ) : e.type==="sketch" ? (
                    <span className="etxt" style={{color:"var(--fg-4)",fontStyle:"italic"}}>[Hand-drawn sketch — view in Ideas tab]</span>
                  ) : (
                    <div className="md-content" onDoubleClick={()=>startEdit(e)}>
                      {renderMarkdown(e.text, lineIdx=>toggleInlineTask(e.id,lineIdx,e.text))}
                    </div>
                  )}
                  {colorPickerId===e.id&&(
                    <div className="cpicker" onClick={ev=>ev.stopPropagation()}>
                      {PALETTE.map(hex=>(
                        <button key={hex} className={`cp-dot ${e.color===hex?"cpa":""}`} style={{"--h":hex}}
                          onClick={()=>{update(e.id,{color:e.color===hex?null:hex});setColorPickerId(null);}}/>
                      ))}
                      <button className="cp-clear" onClick={()=>{update(e.id,{color:null});setColorPickerId(null);}}>clear</button>
                    </div>
                  )}
                </div>
                {e.type!=="sketch"&&<button className="eedit" onClick={()=>startEdit(e)}>✎</button>}
                <button className="edel" onClick={()=>remove(e.id)}>×</button>
                <div className={`entry-ribbon ${e.color?"":"no-color"}`}
                  style={{background:e.color||"var(--border)"}}
                  onClick={ev=>{ev.stopPropagation();setColorPickerId(colorPickerId===e.id?null:e.id);setEditingId(null);}}
                  title="Color tag"/>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Kanban ───────────────────────────────────────────────────────────────────
function Kanban({ tasks, updateTask, quickAdd }) {
  const [dragId,setDragId]   = useState(null);
  const [over,setOver]       = useState(null);
  const [editingId,setEditingId] = useState(null);
  const [editingText,setEditingText] = useState("");
  const [newTask,setNewTask] = useState("");
  const editRef = useRef(null);

  useEffect(()=>{ if(editingId&&editRef.current){editRef.current.focus();editRef.current.select();} },[editingId]);
  const saveEdit  = id => { if(editingText.trim())updateTask(id,{text:editingText.trim()}); setEditingId(null); };
  const startEdit = (ev,t) => { if(t.isInline)return; ev.stopPropagation(); setEditingId(t.id); setEditingText(t.text); };

  return (
    <div className="kb-wrap">
      <div className="kb-add-row">
        <input className="kb-add-in" placeholder="+ Add a task directly…" value={newTask}
          onChange={e=>setNewTask(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&newTask.trim()){quickAdd(newTask,"task");setNewTask("");} }}/>
      </div>
      <div className="kb">
        {KB_COLS.map(col=>{
          const colTasks=tasks.filter(t=>(t.kanban||"backlog")===col.id);
          return (
            <div key={col.id} className={`kc ${over===col.id?"ko":""}`}
              onDragOver={e=>{e.preventDefault();setOver(col.id);}}
              onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOver(null);}}
              onDrop={()=>{ if(dragId){updateTask(dragId,{kanban:col.id,done:col.id==="done"});setDragId(null);setOver(null);} }}>
              <div className="kc-top" style={{background:col.accent}}/>
              <div className="kc-header">
                <span className="kc-sym" style={{color:col.accent}}>{col.sym}</span>
                <span className="kc-title">{col.label}</span>
                <span className="kc-count">{colTasks.length}</span>
              </div>
              <div className="kc-body">
                {colTasks.map(t=>(
                  <div key={t.id}
                    className={`kcard ${dragId===t.id?"kdr":""} ${col.id==="done"?"kdone":""}`}
                    style={{"--kc-accent": t.color||col.accent}}
                    draggable={editingId!==t.id}
                    onDragStart={()=>setDragId(t.id)}
                    onDragEnd={()=>{setDragId(null);setOver(null);}}>
                    {editingId===t.id ? (
                      <textarea ref={editRef} className="k-edit-ta" value={editingText} rows={2}
                        onChange={ev=>setEditingText(ev.target.value)}
                        onKeyDown={ev=>{if(ev.key==="Escape"){setEditingId(null);return;}if(ev.key==="Enter"&&(ev.metaKey||ev.ctrlKey)){ev.preventDefault();saveEdit(t.id);}}}
                        onBlur={()=>saveEdit(t.id)} onMouseDown={ev=>ev.stopPropagation()}/>
                    ):(
                      <div className="kct2" onDoubleClick={ev=>startEdit(ev,t)}>{t.text}</div>
                    )}
                    <div className="kcard-foot">
                      <div className="ktm">
                        {t.isInline && <span style={{marginRight:5,opacity:0.55}}>{T[t.parentType]?.sym||"◦"}</span>}
                        {fmt(t.ts)}
                      </div>
                      {!t.isInline&&editingId!==t.id&&<button className="k-edit-btn" onClick={ev=>startEdit(ev,t)} onMouseDown={ev=>ev.stopPropagation()}>✎</button>}
                    </div>
                  </div>
                ))}
                {colTasks.length===0&&<div className="kemp">drop tasks here</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Ideas ────────────────────────────────────────────────────────────────────
function Ideas({ ideas, archivedIdeas, update, remove, connections, addConnection, removeConnection, quickAdd, bgStrokes, setBgStrokes }) {
  const [cam,setCam]           = useState({x:0,y:0,z:1});
  const [mode,setMode]         = useState("select");
  const [drawColor,setDrawColor] = useState("#4a6fa5");
  const [sketchTool,setSketchTool] = useState("draw");
  const [connectFrom,setConnectFrom] = useState(null);
  const [editingId,setEditingId] = useState(null);
  const [editingText,setEditingText] = useState("");
  const [newIdea,setNewIdea]   = useState("");
  const [showArchive,setShowArchive] = useState(false);
  const vRef=useRef(null),dragRef=useRef(null),editRef=useRef(null),pinch=useRef(null);

  useEffect(()=>{ if(editingId&&editRef.current){editRef.current.focus();editRef.current.select();} },[editingId]);
  useEffect(()=>{
    const el=vRef.current; if(!el)return;
    const onW=e=>{ e.preventDefault(); if(e.ctrlKey||e.metaKey||e.deltaY%1!==0)setCam(c=>({...c,z:Math.max(0.1,Math.min(c.z-e.deltaY*0.005,3))})); else setCam(c=>({...c,x:c.x-e.deltaX,y:c.y-e.deltaY})); };
    el.addEventListener("wheel",onW,{passive:false}); return()=>el.removeEventListener("wheel",onW);
  },[]);

  const zoomToFit = () => {
    if (ideas.length === 0 || !vRef.current) {
      setCam({ x: 0, y: 0, z: 1 });
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ideas.forEach(idea => {
      let x = idea.ideaX, y = idea.ideaY;
      if (x <= 100 && y <= 100 && x > 0 && y > 0) { x *= 8; y *= 6; } // handle legacy
      const w = idea.width || 200;
      const h = idea.height || 140;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });

    minX -= 150; minY -= 150; maxX += 150; maxY += 150;

    const viewW = vRef.current.clientWidth;
    const viewH = vRef.current.clientHeight;
    const contentW = maxX - minX;
    const contentH = maxY - minY;

    const zoomX = viewW / contentW;
    const zoomY = viewH / contentH;
    const newZ = Math.max(0.1, Math.min(zoomX, zoomY, 1));

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    setCam({
      x: (viewW / 2) - (cx * newZ),
      y: (viewH / 2) - (cy * newZ),
      z: newZ
    });
  };

  const saveIdeaEdit = id => { if(editingText.trim())update(id,{text:editingText.trim()}); setEditingId(null); };

  const onVPDown=ev=>{ if(ev.button===2)dragRef.current={type:"pan",startX:ev.clientX,startY:ev.clientY,camX:cam.x,camY:cam.y}; };
  const onTS=ev=>{ if(ev.touches.length===2){const t1=ev.touches[0],t2=ev.touches[1];pinch.current={dist:Math.hypot(t1.clientX-t2.clientX,t1.clientY-t2.clientY),cx:(t1.clientX+t2.clientX)/2,cy:(t1.clientY+t2.clientY)/2,camX:cam.x,camY:cam.y,camZ:cam.z};}else if(ev.touches.length===1&&mode==="select")dragRef.current={type:"pan",startX:ev.touches[0].clientX,startY:ev.touches[0].clientY,camX:cam.x,camY:cam.y}; };
  const onTM=ev=>{ if(ev.touches.length===2&&pinch.current){ev.preventDefault();const t1=ev.touches[0],t2=ev.touches[1];const dist=Math.hypot(t1.clientX-t2.clientX,t1.clientY-t2.clientY);const cx=(t1.clientX+t2.clientX)/2,cy=(t1.clientY+t2.clientY)/2;setCam({z:Math.max(0.1,Math.min(pinch.current.camZ*(dist/pinch.current.dist),3)),x:pinch.current.camX+(cx-pinch.current.cx),y:pinch.current.camY+(cy-pinch.current.cy)});}else if(dragRef.current){ev.preventDefault();onPM(ev.touches[0]);} };
  const onPM=ev=>{ if(!dragRef.current)return;const d=dragRef.current;if(d.type==="pan")setCam(c=>({...c,x:d.camX+(ev.clientX-d.startX),y:d.camY+(ev.clientY-d.startY)}));else if(d.type==="move")update(d.id,{ideaX:d.ix+(ev.clientX-d.sx)/cam.z,ideaY:d.iy+(ev.clientY-d.sy)/cam.z});else if(d.type==="resize")update(d.id,{width:Math.max(120,d.sw+(ev.clientX-d.sx)/cam.z),height:Math.max(100,d.sh+(ev.clientY-d.sy)/cam.z)}); };
  const stopAll=()=>{ dragRef.current=null;pinch.current=null; };

  // Crucial fix: stop propagation of touch starts to isolate dragging
  const stopTouch = (ev) => { ev.stopPropagation(); };

  const onND=(ev,idea)=>{ if(editingId===idea.id||mode==="draw"||mode==="erase"||ev.button===2)return; if(mode==="connect"){ev.stopPropagation();if(!connectFrom){setConnectFrom(idea.id);return;}if(connectFrom!==idea.id&&!connections.find(c=>(c.fromId===connectFrom&&c.toId===idea.id)||(c.fromId===idea.id&&c.toId===connectFrom)))addConnection(connectFrom,idea.id);setConnectFrom(null);return;}ev.preventDefault();ev.stopPropagation();dragRef.current={type:"move",id:idea.id,sx:ev.clientX,sy:ev.clientY,ix:idea.ideaX,iy:idea.ideaY}; };
  const onRD=(ev,idea)=>{ ev.preventDefault();ev.stopPropagation();dragRef.current={type:"resize",id:idea.id,sx:ev.clientX,sy:ev.clientY,sw:idea.width||200,sh:idea.height||140}; };
  const gc=idea=>{ let x=idea.ideaX,y=idea.ideaY; if(x<=100&&y<=100&&x>0&&y>0){x*=8;y*=6;} return{left:x,top:y}; };

  return (
    <div ref={vRef} className="ic-viewport" style={{cursor:mode==="connect"?"crosshair":"default"}}
      onPointerDown={onVPDown} onPointerMove={onPM} onPointerUp={stopAll} onPointerLeave={stopAll}
      onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={stopAll} onTouchCancel={stopAll}
      onContextMenu={e=>e.preventDefault()}>

      {ideas.length===0&&!showArchive&&(
        <div className="ic-empty">
          <div className="ic-empty-sym">◈</div>
          <div>No ideas yet</div>
          <div style={{fontSize:16}}>Type in the box below and press Enter</div>
          <div style={{fontSize:14,marginTop:4}}>or mark journal entries as ◈ Idea</div>
        </div>
      )}
      {ideas.length>0&&<div className="ic-nav-hint">scroll to pan · pinch / ctrl+scroll to zoom · right-drag to pan</div>}

      {/* MOBILE ONLY TOP INPUT */}
      <div className="mobile-quick-add" onTouchStart={stopTouch}>
        <input className="quick-add-in" placeholder="+ Note…" value={newIdea} onChange={e=>setNewIdea(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&newIdea.trim()){quickAdd(newIdea,"idea");setNewIdea("");}}}
          onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onTouchStart={stopTouch}/>
      </div>

      {/* RESPONSIVE DOCK */}
      <div className="floating-dock" onTouchStart={stopTouch}>
        <div className="quick-add-wrap">
          <input className="quick-add-in" placeholder="+ Note…" value={newIdea} onChange={e=>setNewIdea(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&newIdea.trim()){quickAdd(newIdea,"idea");setNewIdea("");}}}
            onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onTouchStart={stopTouch}/>
        </div>
        <button className={`dock-btn ${mode==="select"?"active":""}`} onClick={()=>{setMode("select");setConnectFrom(null);}}>↖ <span className="dock-lbl">Select</span></button>
        <button className={`dock-btn ${mode==="draw"?"active":""}`}   onClick={()=>{setMode("draw");setConnectFrom(null);}}>✎ <span className="dock-lbl">Draw</span></button>
        <button className={`dock-btn ${mode==="erase"?"active":""}`}  onClick={()=>{setMode("erase");setConnectFrom(null);}}>◻ <span className="dock-lbl">Erase</span></button>
        <button className={`dock-btn ${mode==="connect"?"active":""}`} onClick={()=>{setMode("connect");setConnectFrom(null);}}>⚯ <span className="dock-lbl">{connectFrom?"Pick…":"Link"}</span></button>
        <div className="dock-sep"/>
        <button className="dock-btn" onClick={zoomToFit}>⛶ <span className="dock-lbl">Focus</span></button>
        <button className="dock-btn" style={{color:"#7a5c8a"}} onClick={()=>quickAdd("","sketch")}>+ 〰 <span className="dock-lbl">Sketch</span></button>
        <div className="dock-sep"/>
        <button className={`dock-btn ${showArchive?"active":""}`} onClick={()=>setShowArchive(a=>!a)}>⊙ <span className="dock-lbl">Archive</span></button>
        {mode==="draw"&&(
          <div className="cpicker dock-cpicker">
            {PALETTE.map(hex=>(
              <button key={hex} className="cp-dot"
                style={{"--h":hex,width:14,height:14,border:drawColor===hex?"2px solid var(--fg)":"2px solid transparent",boxShadow:drawColor===hex?"0 0 0 1px var(--fg-3)":"none"}}
                onPointerDown={e=>{e.stopPropagation();setDrawColor(hex);}} onTouchStart={stopTouch}/>
            ))}
          </div>
        )}
      </div>

      <div className="ic-canvas" style={{transform:`translate(${cam.x}px,${cam.y}px) scale(${cam.z})`}}>
        <FreehandArea active={mode==="draw"||mode==="erase"} tool={mode} strokes={bgStrokes} onStrokesChange={setBgStrokes} drawColor={drawColor} camScale={cam.z}
          style={{position:"absolute",top:-10000,left:-10000,width:20000,height:20000,zIndex:0}}/>
        <svg style={{position:"absolute",top:-10000,left:-10000,width:20000,height:20000,pointerEvents:"none",zIndex:5,overflow:"visible"}}>
          <g transform="translate(10000,10000)">
            {connections.map(c=>{
              const from=ideas.find(i=>i.id===c.fromId),to=ideas.find(i=>i.id===c.toId);
              if(!from||!to)return null;
              const fp=gc(from),tp=gc(to);
              const x1=fp.left+(from.width||200)/2,y1=fp.top+30,x2=tp.left+(to.width||200)/2,y2=tp.top+30,mx=(x1+x2)/2,my=(y1+y2)/2;
              return(
                <g key={c.id} style={mode==="connect"?{pointerEvents:"all",cursor:"pointer"}:{}}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c8b896" strokeWidth="1.5" strokeDasharray="5,4" opacity="0.7"/>
                  {mode==="connect"&&(<g onClick={ev=>{ev.stopPropagation();removeConnection(c.id);}}>
                    <circle cx={mx} cy={my} r="11" fill="#fdf8ee" stroke="#d8cfbe" strokeWidth="1.5"/>
                    <text x={mx} y={my+5} textAnchor="middle" fontSize="13" fill="#c44a3a" style={{fontFamily:"sans-serif"}}>×</text>
                  </g>)}
                </g>
              );
            })}
          </g>
        </svg>

        {ideas.map(idea=>{
          const pos=gc(idea),iW=idea.width||200,iH=idea.height||140,isEd=editingId===idea.id;
          return(
            <div key={idea.id} className={`inote ${connectFrom===idea.id?"isel":""}`}
              style={{left:pos.left,top:pos.top,width:iW,height:idea.type==="sketch"?iH:"auto",zIndex:isEd?200:10}}
              onPointerDown={ev=>onND(ev,idea)} onTouchStart={stopTouch}>
              <div className={`inote-pin ${idea.type==="sketch"?"sketch-pin":""}`}/>
              {idea.type==="sketch"?(
                <div style={{position:"relative",width:"100%",height:"calc(100% - 34px)",background:"rgba(255,255,255,0.35)",borderRadius:4,marginBottom:6}}>
                  <FreehandArea active={isEd} tool={isEd?sketchTool:"draw"} strokes={idea.strokes||[]} camScale={cam.z}
                    onStrokesChange={s=>update(idea.id,{strokes:s})} drawColor={drawColor}/>
                  <div className="resize-handle" onPointerDown={ev=>onRD(ev,idea)} onTouchStart={stopTouch}/>
                  {isEd&&(
                    <div className="sketch-toolbar" onTouchStart={stopTouch}>
                      <button className={`sketch-tool-btn ${sketchTool==="draw"?"sact":""}`} onPointerDown={e=>{e.stopPropagation();setSketchTool("draw");}}>✎ Draw</button>
                      <button className={`sketch-tool-btn ${sketchTool==="erase"?"sact":""}`} onPointerDown={e=>{e.stopPropagation();setSketchTool("erase");}}>◻ Erase</button>
                      <div className="cpicker" style={{padding:0}}>
                        {PALETTE.map(hex=>(<button key={hex} className="cp-dot" style={{"--h":hex,width:13,height:13,border:drawColor===hex?"2px solid var(--fg)":"2px solid transparent"}} onPointerDown={e=>{e.stopPropagation();setDrawColor(hex);}}/>))}
                      </div>
                      <button className="sketch-tool-btn done-btn" onPointerDown={ev=>{ev.stopPropagation();setEditingId(null);setSketchTool("draw");setMode("select");}}>Done</button>
                    </div>
                  )}
                </div>
              ):(
                <div style={{position:"relative",minHeight:50}}>
                  {isEd?(
                    <textarea ref={editRef} className="idea-edit-ta" value={editingText} rows={3}
                      onChange={ev=>setEditingText(ev.target.value)}
                      onKeyDown={ev=>{if(ev.key==="Escape"){setEditingId(null);return;}if(ev.key==="Enter"&&(ev.metaKey||ev.ctrlKey)){ev.preventDefault();saveIdeaEdit(idea.id);}}}
                      onBlur={()=>saveIdeaEdit(idea.id)} onClick={ev=>ev.stopPropagation()} onPointerDown={ev=>ev.stopPropagation()} onTouchStart={stopTouch}/>
                  ):(
                    <div className="md-content intxt" style={{width:iW-28}}>
                      {idea.isInline ? renderInline(idea.text) : renderMarkdown(idea.text, () => {})}
                    </div>
                  )}
                  <div className="resize-handle" onPointerDown={ev=>onRD(ev,idea)} onTouchStart={stopTouch}/>
                </div>
              )}
              <div className="intm-row">
                <span className="intm">
                  {idea.isInline && <span style={{marginRight:5,opacity:0.55}}>{T[idea.parentType]?.sym||"◦"}</span>}
                  {fmt(idea.ts)}
                </span>
                {!isEd&&(
                  <div className="inote-actions">
                    <button className="inote-action" onPointerDown={ev=>ev.stopPropagation()} onTouchStart={stopTouch} onClick={ev=>{ev.stopPropagation();update(idea.id,{archived:true});}}>⊙ arch</button>
                    <button className="inote-action danger" onPointerDown={ev=>ev.stopPropagation()} onTouchStart={stopTouch} onClick={ev=>{ev.stopPropagation();remove(idea.id);}}>✕</button>
                    {idea.type!=="sketch" && <button className="inote-action" onPointerDown={ev=>ev.stopPropagation()} onTouchStart={stopTouch} onClick={ev=>{ev.stopPropagation();setEditingId(idea.id);setMode("select");setEditingText(idea.text);}}>✎</button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showArchive&&(
        <div className="archive-panel" onTouchStart={stopTouch}>
          <div className="archive-panel-hd"><span>⊙ Archived ({archivedIdeas.length})</span><button className="archive-close" onClick={()=>setShowArchive(false)}>×</button></div>
          <div className="archive-scroll">
            {archivedIdeas.length===0?(<div className="archive-empty">Nothing archived yet.<br/>Use ⊙ arch on a note to archive it.</div>)
            :archivedIdeas.map(idea=>(
              <div key={idea.id} className="archive-item">
                <div className="archive-item-text">{idea.type==="sketch"?"[Sketch]":idea.text||"(empty)"}</div>
                <div className="archive-item-foot">
                  <span className="archive-item-ts">{fmt(idea.ts)}</span>
                  <button className="archive-action" onClick={()=>update(idea.id,{archived:false})}>restore</button>
                  <button className="archive-action del" onClick={()=>remove(idea.id)}>delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function Auth({ setSession }) {
  const [loading,setLoading]=useState(false),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[isSignUp,setIsSignUp]=useState(false);
  const go=async e=>{e.preventDefault();setLoading(true);let r;if(isSignUp){r=await supabase.auth.signUp({email,password});if(!r.error)alert("Account created! You can now log in.");}else r=await supabase.auth.signInWithPassword({email,password});if(r.error)alert(r.error.message);setLoading(false);};
  return(<><style>{CSS}</style><div className="auth-container"><div className="auth-box">
    <div className="auth-title"><span style={{fontSize:22}}>◎</span> interstitial</div>
    <form onSubmit={go}>
      <input className="auth-input" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/>
      <input className="auth-input" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required/>
      <button className="auth-btn" disabled={loading}>{loading?"Processing…":(isSignUp?"Sign Up":"Log In")}</button>
    </form>
    <button className="auth-switch" onClick={()=>setIsSignUp(!isSignUp)}>{isSignUp?"Already have an account? Log In":"Need an account? Sign Up"}</button>
  </div></div></>);
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [session,setSession]=useState(null);
  const [view,setView]=useState("journal");
  const [entries,setEntries]=useState([]);
  const [connections,setConnections]=useState([]);
  const [bgStrokes,setBgStrokes]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [loadError,setLoadError]=useState(null);
  const [sync,setSync]=useState("synced");
  const [input,setInput]=useState("");
  const [inputType,setInputType]=useState("note");
  const saveTimer=useRef(null);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>setSession(session));
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>setSession(session));
    return()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!session)return;
    (async()=>{
      try{
        const{data,error}=await supabase.from("user_journals").select("data").eq("user_id",session.user.id).single();
        if(error&&error.code!=="PGRST116")throw error;
        if(data?.data){setEntries(data.data.entries||[]);setConnections(data.data.connections||[]);setBgStrokes(data.data.bgStrokes||[]);}
      }catch(err){setLoadError(err.message);}
      setLoaded(true);
    })();
  },[session]);

  useEffect(()=>{
    if(!loaded||!session)return;
    setSync("saving");clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(async()=>{
      try{
        const{error}=await supabase.from("user_journals").upsert({user_id:session.user.id,data:{entries,connections,bgStrokes},updated_at:new Date().toISOString()});
        if(error)throw error;setSync("synced");
      }catch{setSync("error");}
    },1200);
    return()=>clearTimeout(saveTimer.current);
  },[entries,connections,bgStrokes,loaded,session]);

  const addEntry=useCallback(()=>{
    if(!input.trim())return;
    setEntries(p=>[{id:uid(),ts:Date.now(),text:input.trim(),type:inputType,done:false,kanban:"backlog",strokes:[],ideaX:50+Math.random()*300,ideaY:50+Math.random()*300,width:200,height:140},...p]);
    setInput("");
  },[input,inputType]);

  const quickAdd=useCallback((text,type)=>{
    if(!text&&type!=="sketch")return;
    setEntries(p=>[{id:uid(),ts:Date.now(),text:text.trim(),type,done:false,kanban:"backlog",strokes:[],ideaX:50+Math.random()*300,ideaY:50+Math.random()*300,width:200,height:140},...p]);
  },[]);

  const update = useCallback((id, patch) => {
    if (isInlineId(id)) {
      const { parentId, lineIndex } = parseInlineId(id);
      setEntries(prev => {
        const parent = prev.find(e => e.id === parentId);
        if (!parent) return prev;
        const np = {};
        
        if (patch.kanban !== undefined) {
          np.inlineTaskKanban = { ...(parent.inlineTaskKanban || {}), [lineIndex]: patch.kanban };
          const lines = parent.text.split("\n");
          if (patch.kanban === "done") lines[lineIndex] = lines[lineIndex].replace(/^- \[ \] /, "- [x] ");
          else lines[lineIndex] = lines[lineIndex].replace(/^- \[x\] /, "- [ ] ");
          np.text = lines.join("\n");
        }

        if (patch.text !== undefined) {
          const lines = parent.text.split("\n");
          const prefixMatch = lines[lineIndex].match(/^(?:-! |◈ )/);
          const prefix = prefixMatch ? prefixMatch[0] : "-! ";
          lines[lineIndex] = prefix + patch.text;
          np.text = lines.join("\n");
        }

        if (patch.ideaX !== undefined || patch.ideaY !== undefined || patch.width !== undefined || patch.height !== undefined) {
          const curPos = parent.inlineIdeaPos?.[lineIndex] || { x: 80, y: 80, w: 200, h: 140 };
          np.inlineIdeaPos = {
            ...(parent.inlineIdeaPos || {}),
            [lineIndex]: {
              x: patch.ideaX !== undefined ? patch.ideaX : curPos.x,
              y: patch.ideaY !== undefined ? patch.ideaY : curPos.y,
              w: patch.width !== undefined ? patch.width : curPos.w,
              h: patch.height !== undefined ? patch.height : curPos.h
            }
          };
        }

        if (patch.archived !== undefined) {
          np.inlineIdeaArchive = { ...(parent.inlineIdeaArchive || {}), [lineIndex]: patch.archived };
        }

        return prev.map(e => e.id === parentId ? { ...e, ...np } : e);
      });
    } else {
      setEntries(p => p.map(e => e.id === id ? { ...e, ...patch } : e));
    }
  }, []);

  const remove = useCallback((id) => {
    if (isInlineId(id)) {
      const { parentId, lineIndex } = parseInlineId(id);
      setEntries(prev => {
        const parent = prev.find(e => e.id === parentId);
        if (!parent) return prev;
        const lines = parent.text.split("\n");
        lines[lineIndex] = lines[lineIndex].replace(/^(?:-! |◈ )/, ""); 
        return prev.map(e => e.id === parentId ? { ...e, text: lines.join("\n") } : e);
      });
      setConnections(p => p.filter(c => c.fromId !== id && c.toId !== id));
    } else {
      setEntries(p => p.filter(e => e.id !== id));
      setConnections(p => p.filter(c => c.fromId !== id && c.toId !== id));
    }
  }, []);

  const addConnection=useCallback((fromId,toId)=>setConnections(p=>[...p,{id:uid(),fromId,toId}]),[]);
  const removeConnection=useCallback((id)=>setConnections(p=>p.filter(c=>c.id!==id)),[]);

  if(!session)return<Auth setSession={setSession}/>;
  if(!loaded)return(<div className="loading"><div>loading your notebook…</div>{loadError&&<div className="load-err">Could not reach Supabase: {loadError}</div>}</div>);

  const regularTasks  = entries.filter(e=>e.type==="task");
  const inlineTasks   = extractInlineTasks(entries);
  const allTasks      = [...regularTasks,...inlineTasks];
  
  const regularIdeas  = entries.filter(e=>(e.type==="idea"||e.type==="sketch"));
  const inlineIdeas   = extractInlineIdeas(entries);
  const allIdeas      = [...regularIdeas,...inlineIdeas];
  
  const activeIdeas   = allIdeas.filter(e=>!e.archived);
  const archivedIdeas = allIdeas.filter(e=>e.archived);
  
  const pendingCount  = allTasks.filter(t=>(t.kanban||"backlog")!=="done").length;

  return(
    <><style>{CSS}</style>
    <div className="app">
      <Nav view={view} setView={setView} pendingCount={pendingCount} onExport={()=>doExport(entries)} sync={sync} onLogout={()=>supabase.auth.signOut()}/>
      {view==="journal"&&<Journal entries={entries} input={input} setInput={setInput} inputType={inputType} setInputType={setInputType} addEntry={addEntry} update={update} remove={remove}/>}
      {view==="kanban" &&<Kanban tasks={allTasks} updateTask={update} quickAdd={quickAdd}/>}
      {view==="ideas"  &&<Ideas ideas={activeIdeas} archivedIdeas={archivedIdeas} update={update} remove={remove} connections={connections} addConnection={addConnection} removeConnection={removeConnection} quickAdd={quickAdd} bgStrokes={bgStrokes} setBgStrokes={setBgStrokes}/>}
      <MobileBottomNav view={view} setView={setView} pendingCount={pendingCount}/>
    </div></>
  );
}