import { applyFormat } from "../../utils/helpers";

export default function FormatToolbar({ value, onChange, textareaRef }) {
  const apply = (type) => {
    const ta = textareaRef.current;
    if (!ta) return;
    
    const { result, ns, ne } = applyFormat(
      type, 
      value, 
      ta.selectionStart, 
      ta.selectionEnd
    );
    
    onChange(result);
    
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(ns, ne);
    });
  };

  return (
    <div style={{
      display: "flex",
      gap: 4,
      padding: "6px 0",
      flexWrap: "wrap",
      borderBottom: "1px solid var(--border-light)",
      marginBottom: 8
    }}>
      <FormatBtn onClick={() => apply("bold")} title="Bold (**text**)">
        <strong>B</strong>
      </FormatBtn>
      <FormatBtn onClick={() => apply("italic")} title="Italic (*text*)">
        <em>I</em>
      </FormatBtn>
      <FormatBtn onClick={() => apply("code")} title="Code (`text`)">
        {"<>"}
      </FormatBtn>
      
      <div style={{ width: 1, background: "var(--border)", margin: "0 4px" }} />
      
      <FormatBtn onClick={() => apply("h2")} title="Heading (## )">
        H2
      </FormatBtn>
      <FormatBtn onClick={() => apply("h3")} title="Subheading (### )">
        H3
      </FormatBtn>
      <FormatBtn onClick={() => apply("bullet")} title="Bullet (- )">•</FormatBtn>
      <FormatBtn onClick={() => apply("number")} title="Numbered list (1. )">1.</FormatBtn>
      <FormatBtn onClick={() => apply("strike")} title="Strikethrough (~~text~~)"><s>S</s></FormatBtn>
      <FormatBtn onClick={() => apply("quote")} title="Blockquote (> )">"</FormatBtn>

      <div style={{ width: 1, background: "var(--border)", margin: "0 4px" }} />

      <FormatBtn
        onClick={() => apply("task")}
        title="Task (- [ ] )"
        style={{ color: "var(--accent)" }}
      >
        ☐ Task
      </FormatBtn>
      <FormatBtn 
        onClick={() => apply("idea")} 
        title="Idea (-! )"
        style={{ color: "var(--amber)" }}
      >
        ◈ Idea
      </FormatBtn>
      <FormatBtn 
        onClick={() => apply("link")} 
        title="Link ([[text]])"
        style={{ color: "var(--purple)" }}
      >
        🔗 Link
      </FormatBtn>
    </div>
  );
}

function FormatBtn({ children, onClick, title, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        padding: "3px 8px",
        border: "1px solid var(--border)",
        borderRadius: 4,
        background: "none",
        cursor: "pointer",
        fontSize: 12,
        fontFamily: "'Inter', sans-serif",
        color: "var(--text-secondary)",
        transition: "all 0.15s",
        ...style
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "var(--accent-light)";
        e.currentTarget.style.color = "var(--text)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "none";
        e.currentTarget.style.color = "var(--text-secondary)";
      }}
    >
      {children}
    </button>
  );
}