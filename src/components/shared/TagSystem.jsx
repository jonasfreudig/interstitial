import { useState } from "react";
import { getTagColor } from "../../utils/helpers";

// Single tag chip component
export function TagChip({ tag, onRemove, onClick, active, size = "md" }) {
  const color = getTagColor(tag);
  
  return (
    <button
      className={`tag-chip ${active ? "" : "outline"}`}
      style={{
        background: active ? color : "transparent",
        color: active ? "white" : color,
        border: `1.5px solid ${color}`,
        fontSize: size === "sm" ? 10 : 12,
        padding: size === "sm" ? "2px 6px" : "3px 10px",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(tag);
      }}
    >
      {tag}
      {onRemove && (
        <span 
          onClick={(e) => {
            e.stopPropagation();
            onRemove(tag);
          }}
          style={{ marginLeft: 4, opacity: 0.7, cursor: "pointer" }}
        >
          ×
        </span>
      )}
    </button>
  );
}

// Tag filter bar for any view
export function TagFilterBar({ allTags, activeFilter, onFilterChange }) {
  if (!allTags.length) return null;
  
  return (
    <div className="tag-filter-bar">
      <span className="tag-filter-label">Filter:</span>
      {allTags.map(tag => (
        <TagChip
          key={tag}
          tag={tag}
          active={activeFilter === tag}
          onClick={() => onFilterChange(activeFilter === tag ? null : tag)}
          size="sm"
        />
      ))}
      {activeFilter && (
        <button
          onClick={() => onFilterChange(null)}
          style={{
            padding: "2px 8px",
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "none",
            cursor: "pointer",
            fontSize: 11,
            fontFamily: "'Inter', sans-serif",
            color: "var(--text-tertiary)",
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

// Tag picker with existing tags and new tag input
export function TagPicker({ 
  allTags, 
  selectedTags, 
  onAddTag, 
  onRemoveTag,
  onClose,
  position = "bottom"
}) {
  const [newTag, setNewTag] = useState("");
  
  const handleAddNew = () => {
    if (newTag.trim()) {
      const tag = newTag.trim().toLowerCase().replace(/\s+/g, "-");
      onAddTag(tag);
      setNewTag("");
    }
  };
  
  const availableTags = allTags.filter(t => !selectedTags.includes(t));
  
  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: 10,
      minWidth: 200,
      boxShadow: "var(--shadow-md)",
      position: "absolute",
      top: position === "bottom" ? "calc(100% + 4px)" : "auto",
      bottom: position === "top" ? "calc(100% + 4px)" : "auto",
      left: 0,
      zIndex: 100,
    }}>
      <input
        value={newTag}
        onChange={e => setNewTag(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") handleAddNew();
          if (e.key === "Escape") onClose?.();
        }}
        placeholder="New tag..."
        autoFocus
        style={{
          width: "100%",
          padding: "6px 10px",
          border: "1px solid var(--border)",
          borderRadius: 6,
          background: "var(--bg)",
          color: "var(--text)",
          fontFamily: "'Inter', sans-serif",
          fontSize: 13,
          outline: "none",
          marginBottom: 8,
        }}
      />
      
      {availableTags.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {availableTags.map(tag => (
            <TagChip
              key={tag}
              tag={tag}
              onClick={() => onAddTag(tag)}
              size="sm"
            />
          ))}
        </div>
      )}
      
      {selectedTags.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-light)" }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>
            Selected:
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {selectedTags.map(tag => (
              <TagChip
                key={tag}
                tag={tag}
                active
                onRemove={onRemoveTag}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Color picker with palette
export function ColorPicker({ value, onChange, onClear }) {
  const PALETTE = [
    "#4a6fa5", "#4a7c59", "#b87333", "#c44a3a", 
    "#7a5c8a", "#5b8888", "#9a6040", "#4a8a7a",
    "#2c2010", "#f2ebe0"
  ];
  
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {PALETTE.map(color => (
        <button
          key={color}
          onClick={() => onChange(color)}
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: color,
            border: value === color ? "3px solid var(--text)" : "2px solid transparent",
            cursor: "pointer",
            transition: "transform 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.2)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        />
      ))}
      {onClear && (
        <button
          onClick={onClear}
          style={{
            padding: "2px 8px",
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "none",
            cursor: "pointer",
            fontSize: 11,
            fontFamily: "'Inter', sans-serif",
            color: "var(--text-secondary)",
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}