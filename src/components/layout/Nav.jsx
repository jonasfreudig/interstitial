import { supabase } from "../../supabaseClient";

export default function Nav({ view, setView, syncStatus, onExport, theme, setTheme }) {
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