import { supabase } from "../../supabaseClient";
import { ACCENTS } from "../../App";

export default function Nav({ view, setView, syncStatus, onExport, theme, setTheme, accent, setAccent, onOpenSearch, onOpenTimer, timerRunning }) {
  const syncLabels = {
    synced: "saved",
    saving: "saving...",
    error: "error"
  };

  return (
    <nav className="nav">
      <div className="nav-logo">
        <span className="nav-logo-dot" />
        interstitial
      </div>
      
      <button 
        className={`nav-btn ${view === "journal" ? "active" : ""}`}
        onClick={() => setView("journal")}
      >
        ◎ Journal
      </button>
      
      <button 
        className={`nav-btn ${view === "kanban" ? "active" : ""}`}
        onClick={() => setView("kanban")}
      >
        ⊞ Tasks
      </button>
      
      <button 
        className={`nav-btn ${view === "ideas" ? "active" : ""}`}
        onClick={() => setView("ideas")}
      >
        ◈ Ideas
      </button>
      
      <button 
        className={`nav-btn ${view === "docs" ? "active" : ""}`}
        onClick={() => setView("docs")}
      >
        ≡ Docs
      </button>
      
      <div style={{ flex: 1 }} />

      <button className="nav-btn" onClick={onOpenSearch} title="Search (⌘K)">
        ◎ Search
      </button>

      <button
        className="nav-btn"
        onClick={onOpenTimer}
        title="Pomodoro Timer"
        style={timerRunning ? { background: "rgba(196,74,58,0.12)", color: "var(--red)", borderColor: "var(--red)" } : {}}
      >
        {timerRunning ? "⏱ Running" : "⏱ Focus"}
      </button>

      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className="nav-btn"
        style={{ WebkitAppearance: "none", outline: "none", background: "transparent" }}
      >
        <option value="system">System Theme</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="sepia">Sepia</option>
      </select>

      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", border: "1px solid var(--border)", borderRadius: 20 }}>
        {ACCENTS.map(a => (
          <button
            key={a.value}
            title={a.name}
            onClick={() => setAccent(a.value)}
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: a.value,
              border: accent === a.value ? `2px solid var(--text)` : "2px solid transparent",
              outline: accent === a.value ? `2px solid ${a.value}` : "none",
              outlineOffset: 1,
              cursor: "pointer",
              transition: "transform 0.15s",
              flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.25)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          />
        ))}
      </div>

      <button className="nav-btn" onClick={onExport}>
        ↓ Export
      </button>
      
      <button 
        className="nav-btn" 
        onClick={() => supabase.auth.signOut()}
      >
        Logout
      </button>
      
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: 6, 
        marginLeft: 8,
        fontSize: 12,
        fontFamily: "'Inter', sans-serif",
        color: syncStatus === "synced" ? "var(--green)" : 
               syncStatus === "error" ? "var(--red)" : "var(--text-tertiary)"
      }}>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: syncStatus === "synced" ? "var(--green)" : 
                     syncStatus === "error" ? "var(--red)" : "var(--amber)",
        }} />
        {syncLabels[syncStatus]}
      </div>
    </nav>
  );
}