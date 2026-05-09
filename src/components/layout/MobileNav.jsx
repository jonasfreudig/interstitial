export default function MobileNav({ view, setView, onOpenTimer, timerRunning }) {
  const TABS = [
    { id: "journal", sym: "◎", lbl: "Journal" },
    { id: "kanban",  sym: "⊞", lbl: "Tasks"   },
    { id: "ideas",   sym: "◈", lbl: "Ideas"   },
    { id: "docs",    sym: "≡", lbl: "Docs"    },
  ];

  return (
    <nav className="mobile-nav">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`mobile-nav-btn ${view === tab.id ? "active" : ""}`}
          onClick={() => setView(tab.id)}
        >
          <span className="sym" style={{ display: "block", transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)" }}>
            {tab.sym}
          </span>
          <span className="lbl">{tab.lbl}</span>
        </button>
      ))}

      <button
        className="mobile-nav-btn"
        onClick={onOpenTimer}
        style={timerRunning ? { color: "var(--red)" } : {}}
      >
        <span
          className="sym"
          style={{
            display: "block",
            animation: timerRunning ? "timerPulse 2s ease-in-out infinite" : "none",
          }}
        >
          ⏱
        </span>
        <span className="lbl">{timerRunning ? "Focus" : "Timer"}</span>
      </button>

      <style>{`
        @keyframes timerPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.88); }
        }
        .mobile-nav-btn {
          transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease;
        }
        .mobile-nav-btn:active {
          transform: scale(0.9);
        }
        .mobile-nav-btn.active .sym {
          transform: scale(1.15);
        }
        .mobile-nav-btn .sym {
          transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
        }
      `}</style>
    </nav>
  );
}
