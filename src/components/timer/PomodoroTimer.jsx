import { useState, useEffect, useRef } from "react";

const DEFAULT_SETTINGS = { work: 25, shortBreak: 5, longBreak: 15, sessionsBeforeLong: 4 };

const PHASE_META = {
  idle:          { label: "Ready",       col: "var(--accent)" },
  work:          { label: "Focus",       col: "var(--red)" },
  "short-break": { label: "Short Break", col: "var(--green)" },
  "long-break":  { label: "Long Break",  col: "var(--purple)" },
};

function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export default function PomodoroTimer({ onClose, onRunningChange }) {
  const [settings, setSettings] = useState(() => loadLS("pomodoro-settings", DEFAULT_SETTINGS));
  const [editSettings, setEditSettings] = useState(null); // null = not editing
  const [phase, setPhase] = useState("idle");
  const [timeLeft, setTimeLeft] = useState(() => loadLS("pomodoro-settings", DEFAULT_SETTINGS).work * 60);
  const [running, setRunning] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [tab, setTab] = useState("timer"); // "timer" | "stats" | "settings"
  const [sessions, setSessions] = useState(() => loadLS("pomodoro-sessions", []));

  // Keep latest handler in ref to avoid stale closures in interval
  const stateRef = useRef({});
  stateRef.current = { phase, cycleCount, settings, sessions };

  const addSession = (session) => {
    setSessions(prev => {
      const updated = [...prev, session];
      saveLS("pomodoro-sessions", updated);
      return updated;
    });
  };

  const phaseEnd = () => {
    const { phase, cycleCount, settings } = stateRef.current;
    setRunning(false);

    if (phase === "work") {
      addSession({
        id: Date.now().toString(),
        date: new Date().toISOString().slice(0, 10),
        duration: settings.work,
        completedAt: Date.now(),
      });
      const newCount = cycleCount + 1;
      setCycleCount(newCount);
      if (newCount % settings.sessionsBeforeLong === 0) {
        setPhase("long-break");
        setTimeLeft(settings.longBreak * 60);
      } else {
        setPhase("short-break");
        setTimeLeft(settings.shortBreak * 60);
      }
      notify("Work session done! Take a break 🎉");
    } else {
      setPhase("work");
      setTimeLeft(settings.work * 60);
      notify("Break over. Time to focus ⏱");
    }
  };

  const phaseEndRef = useRef(phaseEnd);
  phaseEndRef.current = phaseEnd;

  useEffect(() => { onRunningChange?.(running); }, [running]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { setTimeout(() => phaseEndRef.current(), 0); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const notify = (msg) => {
    if (Notification.permission === "granted") new Notification(msg);
  };

  const start = () => {
    if (Notification.permission === "default") Notification.requestPermission();
    if (phase === "idle") { setPhase("work"); setTimeLeft(settings.work * 60); }
    setRunning(true);
  };

  const reset = () => {
    setRunning(false);
    setPhase("idle");
    setTimeLeft(settings.work * 60);
    setCycleCount(0);
  };

  const skip = () => { setRunning(false); phaseEndRef.current(); };

  const saveSettings = (s) => {
    setSettings(s);
    saveLS("pomodoro-settings", s);
    setPhase("idle");
    setTimeLeft(s.work * 60);
    setRunning(false);
    setEditSettings(null);
    setTab("timer");
  };

  // Stats
  const today = new Date().toISOString().slice(0, 10);
  const thisWeekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todaySessions = sessions.filter(s => s.date === today);
  const weekSessions = sessions.filter(s => s.date >= thisWeekStart);
  const todayMins = todaySessions.reduce((a, s) => a + s.duration, 0);
  const weekMins = weekSessions.reduce((a, s) => a + s.duration, 0);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const meta = PHASE_META[phase] || PHASE_META.idle;
  const phaseDuration = phase === "work" ? settings.work * 60 : phase === "short-break" ? settings.shortBreak * 60 : settings.longBreak * 60;
  const progress = phase === "idle" ? 0 : 1 - timeLeft / phaseDuration;
  const dots = settings.sessionsBeforeLong || 4;

  const es = editSettings || settings;

  return (
    <div style={{ position: "fixed", bottom: 76, right: 20, zIndex: 500, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, boxShadow: "var(--shadow-lg)", width: 300, fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", flex: 1 }}>⏱ Pomodoro</span>
        {["timer", "stats", "settings"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ fontSize: 12, padding: "3px 8px", border: "none", borderRadius: 8, background: tab === t ? "var(--accent-light)" : "none", color: tab === t ? "var(--accent)" : "var(--text-tertiary)", cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
            {t === "timer" ? "⏱" : t === "stats" ? "◎" : "⚙"}
          </button>
        ))}
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 18, padding: "0 2px" }}>×</button>
      </div>

      {tab === "timer" && (
        <div style={{ padding: "16px", textAlign: "center" }}>
          {/* Session dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 10 }}>
            {Array.from({ length: dots }).map((_, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i < cycleCount % (dots || 1) ? meta.col : "var(--border)", transition: "background 0.3s" }} />
            ))}
          </div>

          {/* Phase */}
          <div style={{ fontSize: 11, fontWeight: 600, color: meta.col, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{meta.label}</div>

          {/* Time display */}
          <div style={{ fontSize: 58, fontWeight: 700, color: "var(--text)", letterSpacing: "-2px", fontVariantNumeric: "tabular-nums", lineHeight: 1.1, marginBottom: 10 }}>{timeStr}</div>

          {/* Progress bar */}
          <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginBottom: 16, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress * 100}%`, background: meta.col, borderRadius: 2, transition: "width 1s linear" }} />
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={running ? () => setRunning(false) : start} style={{ flex: 1, padding: "10px", background: running ? "var(--bg)" : meta.col, color: running ? "var(--text)" : "white", border: running ? "1px solid var(--border)" : "none", borderRadius: 10, cursor: "pointer", fontSize: 15, fontWeight: 600 }}>
              {running ? "⏸ Pause" : phase === "idle" ? "▶ Start" : "▶ Resume"}
            </button>
            {phase !== "idle" && (
              <button onClick={skip} style={{ padding: "10px 12px", background: "none", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", fontSize: 14, color: "var(--text-secondary)" }} title="Skip phase">⏭</button>
            )}
            <button onClick={reset} style={{ padding: "10px 12px", background: "none", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", fontSize: 14, color: "var(--text-secondary)" }} title="Reset">↺</button>
          </div>

          {/* Mini stats */}
          {todaySessions.length > 0 && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--bg)", borderRadius: 8, fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 12, justifyContent: "center" }}>
              <span>{todaySessions.length} sessions today</span>
              <span>·</span>
              <span>{todayMins} min focused</span>
            </div>
          )}
        </div>
      )}

      {tab === "stats" && (
        <div style={{ padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Today sessions", value: todaySessions.length },
              { label: "Today minutes", value: todayMins },
              { label: "This week sessions", value: weekSessions.length },
              { label: "This week minutes", value: weekMins },
            ].map((s, i) => (
              <div key={i} style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px", border: "1px solid var(--border-light)", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6, fontWeight: 500 }}>Recent sessions</div>
          <div style={{ maxHeight: 130, overflow: "auto" }}>
            {sessions.length === 0
              ? <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-tertiary)", fontSize: 13 }}>No sessions yet</div>
              : [...sessions].reverse().slice(0, 20).map(s => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border-light)", fontSize: 12 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{s.date}</span>
                  <span style={{ color: "var(--green)", fontWeight: 500 }}>{s.duration} min</span>
                </div>
              ))
            }
          </div>

          {sessions.length > 0 && (
            <button onClick={() => { if (window.confirm("Clear all session history?")) { setSessions([]); saveLS("pomodoro-sessions", []); }}} style={{ marginTop: 10, width: "100%", padding: "6px", background: "none", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif" }}>
              Clear history
            </button>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div style={{ padding: 16 }}>
          {[
            ["work", "Work duration (minutes)", 1, 120],
            ["shortBreak", "Short break (minutes)", 1, 30],
            ["longBreak", "Long break (minutes)", 1, 60],
            ["sessionsBeforeLong", "Sessions before long break", 1, 10],
          ].map(([key, label, min, max]) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="range" min={min} max={max}
                  value={es[key]}
                  onChange={e => setEditSettings({ ...es, [key]: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: "var(--accent)" }}
                />
                <span style={{ minWidth: 28, textAlign: "right", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{es[key]}</span>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={() => saveSettings(es)} style={{ flex: 1, padding: "9px", background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>Save</button>
            <button onClick={() => { setEditSettings(null); setTab("timer"); }} style={{ flex: 1, padding: "9px", background: "none", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
