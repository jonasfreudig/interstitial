export default function MobileNav({ view, setView }) {
  return (
    <nav className="mobile-nav">
      <button 
        className={`mobile-nav-btn ${view === "journal" ? "active" : ""}`}
        onClick={() => setView("journal")}
      >
        <span className="sym">◎</span>
        <span className="lbl">Journal</span>
      </button>
      
      <button 
        className={`mobile-nav-btn ${view === "kanban" ? "active" : ""}`}
        onClick={() => setView("kanban")}
      >
        <span className="sym">⊞</span>
        <span className="lbl">Tasks</span>
      </button>
      
      <button 
        className={`mobile-nav-btn ${view === "ideas" ? "active" : ""}`}
        onClick={() => setView("ideas")}
      >
        <span className="sym">◈</span>
        <span className="lbl">Ideas</span>
      </button>
      
      <button 
        className={`mobile-nav-btn ${view === "docs" ? "active" : ""}`}
        onClick={() => setView("docs")}
      >
        <span className="sym">≡</span>
        <span className="lbl">Docs</span>
      </button>
    </nav>
  );
}