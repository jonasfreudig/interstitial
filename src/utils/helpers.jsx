// ---- ID Generation ----
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ---- Date Formatting ----
export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("de-DE", { 
    hour: "2-digit", 
    minute: "2-digit" 
  });
}

export function formatDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  
  if (d.toDateString() === today.toDateString()) return "Today";
  
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  
  return d.toLocaleDateString("de-DE", { 
    weekday: "long", 
    day: "numeric", 
    month: "long" 
  });
}

export function formatShort(ts) {
  return new Date(ts).toLocaleDateString("de-DE", { 
    day: "numeric", 
    month: "short" 
  });
}

export function formatFull(ts) {
  return new Date(ts).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

// ---- Color & Tags ----
export const TAG_COLORS = [
  "#4a6fa5", "#4a7c59", "#b87333", "#c44a3a", 
  "#7a5c8a", "#5b8888", "#9a6040", "#4a8a7a"
];

export function getTagColor(name) {
  const hash = name.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export const PALETTE = [
  "#4a6fa5", "#4a7c59", "#b87333", "#c44a3a", 
  "#7a5c8a", "#5b8888", "#9a6040", "#4a8a7a",
  "#2c2010", "#f2ebe0"
];

// ---- Entry Types ----
export const ENTRY_TYPES = {
  note:   { sym: "◦",  label: "Note",   col: "#4a7c59" },
  task:   { sym: "⊞",  label: "Task",   col: "#4a6fa5" },
  idea:   { sym: "◈",  label: "Idea",   col: "#b87333" },
  sketch: { sym: "〰",  label: "Sketch", col: "#7a5c8a" },
};

export const KANBAN_COLS = [
  { id: "backlog",     label: "Backlog",     sym: "◎", accent: "#4a6fa5" },
  { id: "in-progress", label: "In Progress", sym: "◐", accent: "#b87333" },
  { id: "done",        label: "Done",        sym: "●", accent: "#4a7c59" },
];

// ---- Markdown Rendering ----
export function renderInline(text) {
  if (!text) return null;
  
  const parts = [];
  let lastIndex = 0;
  const regex = /(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`|\[\[([^\]]+)\]\])/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    if (match[2] !== undefined) {
      // Bold
      parts.push({ type: "bold", content: match[2] });
    } else if (match[3] !== undefined) {
      // Italic
      parts.push({ type: "italic", content: match[3] });
    } else if (match[4] !== undefined) {
      // Code
      parts.push({ type: "code", content: match[4] });
    } else if (match[5] !== undefined) {
      // Wiki link
      parts.push({ type: "link", query: match[5], raw: match[0] });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts;
}

export function renderMarkdown(text, options = {}) {
  if (!text) return [];
  
  const { onToggleTask, onLinkClick, resolvedLinks = {} } = options;
  
  return text.split("\n").map((line, i) => {
    // Headings
    if (line.startsWith("## ")) {
      return { type: "h2", content: line.slice(3), key: i };
    }
    if (line.startsWith("### ")) {
      return { type: "h3", content: line.slice(4), key: i };
    }
    
    // Task
    const taskMatch = line.match(/^- \[([ x])\] (.+)$/);
    if (taskMatch) {
      return {
        type: "task",
        done: taskMatch[1] === "x",
        content: taskMatch[2],
        lineIndex: i,
        key: i
      };
    }
    
    // Idea line
    const ideaMatch = line.match(/^(?:-! |◈ )(.+)$/);
    if (ideaMatch) {
      return { type: "idea", content: ideaMatch[1], key: i };
    }
    
    // Bullet
    if (line.startsWith("- ")) {
      return { type: "bullet", content: line.slice(2), key: i };
    }
    
    // Empty line
    if (line.trim() === "") {
      return { type: "spacer", key: i };
    }
    
    // Regular paragraph
    return { type: "paragraph", content: line, key: i };
  });
}

// ---- Markdown Rendering to JSX ----
export function MarkdownContent({ text, onToggleTask, onLinkClick, linkMap = {} }) {
  if (!text) return null;
  
  const lines = renderMarkdown(text, { onToggleTask, onLinkClick, linkMap });
  
  return lines.map(line => {
    switch (line.type) {
      case "h2":
        return <div key={line.key} className="markdown-content"><h2>{renderInlineToJSX(line.content, onLinkClick)}</h2></div>;
      case "h3":
        return <div key={line.key} className="markdown-content"><h3>{renderInlineToJSX(line.content, onLinkClick)}</h3></div>;
      case "task":
        return (
          <div key={line.key} className={`task-line ${line.done ? "done" : ""}`}>
            <input 
              type="checkbox" 
              checked={line.done} 
              readOnly 
              onClick={() => onToggleTask?.(line.lineIndex)}
            />
            <span>{renderInlineToJSX(line.content, onLinkClick)}</span>
          </div>
        );
      case "idea":
        return <div key={line.key} className="idea-line">◈ {renderInlineToJSX(line.content, onLinkClick)}</div>;
      case "bullet":
        return <div key={line.key} className="markdown-content">• {renderInlineToJSX(line.content, onLinkClick)}</div>;
      case "spacer":
        return <div key={line.key} style={{ height: 8 }} />;
      case "paragraph":
        return <div key={line.key} className="markdown-content">{renderInlineToJSX(line.content, onLinkClick)}</div>;
      default:
        return null;
    }
  });
}

function renderInlineToJSX(text, onLinkClick) {
  const parts = renderInline(text);
  if (!parts || parts.length === 0) return text;
  
  if (typeof parts === "string") return parts;
  
  return parts.map((part, i) => {
    if (typeof part === "string") return part;
    
    switch (part.type) {
      case "bold":
        return <strong key={i}>{part.content}</strong>;
      case "italic":
        return <em key={i}>{part.content}</em>;
      case "code":
        return <code key={i}>{part.content}</code>;
      case "link":
        return (
          <span 
            key={i} 
            className="doc-link"
            onClick={() => onLinkClick?.(part.query)}
          >
            {part.raw}
          </span>
        );
      default:
        return null;
    }
  });
}

// ---- Format Toolbar Helpers ----
export function applyFormat(type, value, selStart, selEnd) {
  const selected = value.slice(selStart, selEnd);
  const before = value.slice(0, selStart);
  const after = value.slice(selEnd);
  
  const formats = {
    bold: { prefix: "**", suffix: "**", placeholder: "bold" },
    italic: { prefix: "*", suffix: "*", placeholder: "italic" },
    code: { prefix: "`", suffix: "`", placeholder: "code" },
    h2: { prefix: "## ", suffix: "", placeholder: "" },
    h3: { prefix: "### ", suffix: "", placeholder: "" },
    bullet: { prefix: "- ", suffix: "", placeholder: "" },
    task: { prefix: "- [ ] ", suffix: "", placeholder: "" },
    idea: { prefix: "-! ", suffix: "", placeholder: "" },
    link: { prefix: "[[", suffix: "]]", placeholder: "link" },
  };
  
  const fmt = formats[type];
  if (!fmt) return { result: value, ns: selStart, ne: selEnd };
  
  // Toggle off if already wrapped
  if (selected.startsWith(fmt.prefix) && selected.endsWith(fmt.suffix)) {
    const inner = selected.slice(fmt.prefix.length, -fmt.suffix.length || undefined);
    const result = before + inner + after;
    return { 
      result, 
      ns: selStart, 
      ne: selStart + inner.length 
    };
  }
  
  const inner = selected || fmt.placeholder;
  const result = before + fmt.prefix + inner + fmt.suffix + after;
  const ns = selStart + fmt.prefix.length;
  const ne = ns + inner.length;
  
  return { result, ns, ne };
}

// ---- Canvas Helpers ----
export function isInsideFrame(item, frame) {
  const x = item.ideaX || item.canvasX || 0;
  const y = item.ideaY || item.canvasY || 0;
  const w = item.width || item.canvasW || 200;
  const h = item.height || item.canvasH || 140;
  
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  return cx >= frame.x && cx <= frame.x + frame.w &&
         cy >= frame.y && cy <= frame.y + frame.h;
}

export function getItemsInFrame(frame, entries, docs) {
  const items = [];
  
  entries.forEach(entry => {
    if ((entry.type === "idea" || entry.type === "sketch") && 
        isInsideFrame(entry, frame)) {
      items.push({ type: "entry", ...entry });
    }
  });
  
  docs.forEach(doc => {
    if (doc.onCanvas && isInsideFrame({
      ideaX: doc.canvasX,
      ideaY: doc.canvasY,
      width: doc.canvasW || 240,
      height: 140
    }, frame)) {
      items.push({ type: "doc", ...doc });
    }
  });
  
  return items;
}

// ---- Search ----
export function searchEntries(entries, query) {
  if (!query.trim()) return entries;
  const q = query.toLowerCase();
  return entries.filter(e => 
    e.text?.toLowerCase().includes(q) ||
    e.tags?.some(t => t.toLowerCase().includes(q))
  );
}

export function searchDocs(docs, query) {
  if (!query.trim()) return docs;
  const q = query.toLowerCase();
  return docs.filter(d => 
    d.title?.toLowerCase().includes(q) ||
    d.content?.toLowerCase().includes(q) ||
    d.tags?.some(t => t.toLowerCase().includes(q))
  );
}

// ---- Inline Task Extraction (for kanban) ----
export function extractInlineTasks(entries) {
  const tasks = [];
  entries.forEach(entry => {
    if (!entry.text || entry.type === "task" || entry.type === "sketch") return;
    
    entry.text.split("\n").forEach((line, lineIndex) => {
      const match = line.match(/^- \[([ x])\] (.+)$/);
      if (!match) return;
      
      tasks.push({
        id: `${entry.id}::${lineIndex}`,
        parentId: entry.id,
        text: match[2],
        done: match[1] === "x",
        kanban: entry.inlineTaskKanban?.[lineIndex] || (match[1] === "x" ? "done" : "backlog"),
        ts: entry.ts,
        isInline: true,
      });
    });
  });
  return tasks;
}

// ---- Export ----
export function exportToMarkdown(entries, docs) {
  let md = "# Interstitial Journal\n\n";
  md += `Exported: ${formatFull(Date.now())}\n\n---\n\n`;
  
  // Group entries by date
  const grouped = {};
  entries.forEach(e => {
    const date = formatDate(e.ts);
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(e);
  });
  
  Object.entries(grouped).forEach(([date, items]) => {
    md += `## ${date}\n\n`;
    items.forEach(e => {
      md += `### ${formatTime(e.ts)} ${ENTRY_TYPES[e.type]?.sym || "◦"}\n`;
      md += `${e.text}\n`;
      if (e.tags?.length) md += `tags: ${e.tags.join(", ")}\n`;
      md += "\n";
    });
  });
  
  if (docs.length > 0) {
    md += "---\n\n# Documents\n\n";
    docs.forEach(d => {
      md += `## ${d.title || "Untitled"}\n\n`;
      md += `${d.content || ""}\n\n`;
      if (d.tags?.length) md += `tags: ${d.tags.join(", ")}\n\n`;
      md += "---\n\n";
    });
  }
  
  return md;
}