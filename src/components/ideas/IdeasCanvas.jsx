import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { TagChip, ColorPicker } from "../shared/TagSystem";
import { MarkdownContent } from "../../utils/helpers";
import { formatTime, formatShort, generateId, isInsideFrame } from "../../utils/helpers";
import { ENTRY_TYPES, PALETTE } from "../../utils/helpers";

function FreehandArea({ strokes = [], onStrokesChange, active, style, drawColor = "#2c2010", tool = "draw", camScale = 1 }) {
  const [cur, setCur] = useState(null);
  const getP = e => { const r = e.currentTarget.getBoundingClientRect(); return [(e.clientX - r.left) / camScale, (e.clientY - r.top) / camScale]; };
  const erase = ([px, py]) => { const f = strokes.filter(s => { const p = Array.isArray(s) ? s : s.points; return !p.some(pt => Math.hypot(pt[0] - px, pt[1] - py) < 15); }); if (f.length !== strokes.length) onStrokesChange(f); };
  const pd = pts => pts && pts.length ? "M " + pts.map(p => `${p[0]},${p[1]}`).join(" L ") : "";
  return (
    <svg style={{ width: '100%', height: '100%', touchAction: 'none', pointerEvents: active ? 'all' : 'none', cursor: tool === 'erase' ? 'cell' : 'crosshair', ...style }}
      onPointerDown={e => { 
        if (!active || e.button === 2) return; 
        e.stopPropagation(); 
        e.currentTarget.setPointerCapture(e.pointerId); 
        tool === 'draw' ? setCur({ color: drawColor, points: [getP(e)] }) : erase(getP(e)); 
      }}
      onPointerMove={e => { 
        if (!active) return; 
        tool === 'draw' && cur ? setCur({ ...cur, points: [...cur.points, getP(e)] }) : tool === 'erase' && e.buttons === 1 && erase(getP(e)); 
      }}
      onPointerUp={() => { 
        if (tool === 'draw' && cur) { onStrokesChange([...strokes, cur]); setCur(null); } 
      }}
      onPointerCancel={() => setCur(null)}>
      {strokes.map((s, i) => { const p = Array.isArray(s) ? s : s.points; return <path key={i} d={pd(p)} fill="none" stroke={s.color || drawColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />; })}
      {cur && <path d={pd(cur.points)} fill="none" stroke={cur.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

export default function IdeasCanvas({
  entries, docs, connections, frames, bgStrokes, onAddEntry,
  onUpdateEntry, onRemoveEntry, onUpdateDoc, onAddConnection, onRemoveConnection,
  onUpdateFrame, onAddFrame, onRemoveFrame, onSetBgStrokes, openDoc
}) {
  const [cam, setCam] = useState({ x: 0, y: 0, z: 1 });
  const [mode, setMode] = useState("select");
  const [drawColor, setDrawColor] = useState("#4a6fa5");
  const [connectFrom, setConnectFrom] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [newIdea, setNewIdea] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [framePreview, setFramePreview] = useState(null);
  const [editingFrameId, setEditingFrameId] = useState(null);
  const [sketchTool, setSketchTool] = useState("draw");
  const [colorPickerId, setColorPickerId] = useState(null);
  
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const editRef = useRef(null);
  const pinchRef = useRef(null);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Autofocus when editing a note
  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      const len = editRef.current.value.length;
      editRef.current.setSelectionRange(len, len);
    }
  }, [editingId]);

  // N key: drop new idea at viewport center
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "n" && e.key !== "N") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || editingId) return;
      const vw = viewportRef.current?.clientWidth || 800;
      const vh = viewportRef.current?.clientHeight || 600;
      const x = (vw / 2 - cam.x) / cam.z;
      const y = (vh / 2 - cam.y) / cam.z;
      onAddEntry({ text: "", type: "idea", ideaX: x - 110, ideaY: y - 80, width: 220, height: 160, strokes: [], archived: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingId, cam, onAddEntry]);

  const fitToFrame = useCallback((frame) => {
    const vw = viewportRef.current?.clientWidth || 800;
    const vh = viewportRef.current?.clientHeight || 600;
    const padding = 60;
    const newZ = Math.min((vw - padding * 2) / frame.w, (vh - padding * 2) / frame.h, 2);
    setCam({
      x: vw / 2 - (frame.x + frame.w / 2) * newZ,
      y: vh / 2 - (frame.y + frame.h / 2) * newZ,
      z: Math.max(0.1, newZ)
    });
  }, []);

  const activeIdeas = useMemo(() => entries.filter(e => (e.type === "idea" || e.type === "sketch") && !e.archived), [entries]);
  const archivedIdeas = useMemo(() => entries.filter(e => (e.type === "idea" || e.type === "sketch") && e.archived), [entries]);
  const docCards = useMemo(() => docs.filter(d => d.onCanvas), [docs]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || (Math.abs(e.deltaY) >= 10 && e.deltaY % 1 === 0 && e.deltaX === 0)) {
        setCam(c => {
          const rect = el.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          const zoomFactor = Math.pow(0.995, e.deltaY);
          const newZ = Math.max(0.05, Math.min(c.z * zoomFactor, 4));
          const canvasX = (mouseX - c.x) / c.z;
          const canvasY = (mouseY - c.y) / c.z;
          return {
            x: mouseX - canvasX * newZ,
            y: mouseY - canvasY * newZ,
            z: newZ
          };
        });
      } else {
        setCam(c => ({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const getPos = (item) => {
    let x = item.ideaX ?? item.canvasX ?? 200;
    let y = item.ideaY ?? item.canvasY ?? 200;
    if (x <= 100 && y <= 100 && x > 0 && y > 0) { x *= 8; y *= 6; }
    return { left: x, top: y };
  };

  const getItemsInFrame = useCallback((frame) => {
    const items = [];
    activeIdeas.forEach(idea => {
      const pos = getPos(idea);
      const scale = idea.scale || 1;
      const w = (idea.width || 220) * scale;
      const h = (idea.height || 160) * scale;
      if (pos.left + w / 2 >= frame.x && pos.left + w / 2 <= frame.x + frame.w && pos.top + h / 2 >= frame.y && pos.top + h / 2 <= frame.y + frame.h) {
        items.push({ _itemType: "entry", ...idea, _posX: pos.left, _posY: pos.top });
      }
    });
    docCards.forEach(doc => {
      const pos = getPos({ ideaX: doc.canvasX, ideaY: doc.canvasY });
      const scale = doc.scale || 1;
      const w = (doc.canvasW || 240) * scale;
      const h = 140 * scale;
      if (pos.left + w / 2 >= frame.x && pos.left + w / 2 <= frame.x + frame.w && pos.top + h / 2 >= frame.y && pos.top + h / 2 <= frame.y + frame.h) {
        items.push({ _itemType: "doc", ...doc, _posX: pos.left, _posY: pos.top });
      }
    });
    return items;
  }, [activeIdeas, docCards]);

  const onPointerDown = (e) => {
    if (e.button === 2 || mode === "draw" || mode === "erase") return;
    if (mode === "frame") {
      const rect = viewportRef.current.getBoundingClientRect();
      dragRef.current = { type: "newframe", sx: (e.clientX - rect.left - cam.x) / cam.z, sy: (e.clientY - rect.top - cam.y) / cam.z };
      return;
    }
    dragRef.current = { type: "pan", startX: e.clientX, startY: e.clientY, camX: cam.x, camY: cam.y };
  };

  const onPointerMove = (e) => {
    if (pinchRef.current) return;
    if (!dragRef.current) return;
    const d = dragRef.current;
    if (d.type === "pan") {
      setCam(c => ({ ...c, x: d.camX + (e.clientX - d.startX), y: d.camY + (e.clientY - d.startY) }));
    } else if (d.type === "move") {
      onUpdateEntry(d.id, { ideaX: d.ix + (e.clientX - d.sx) / cam.z, ideaY: d.iy + (e.clientY - d.sy) / cam.z });
    } else if (d.type === "resize") {
      onUpdateEntry(d.id, { width: Math.max(120, d.sw + (e.clientX - d.sx) / cam.z / d.scale), height: Math.max(80, d.sh + (e.clientY - d.sy) / cam.z / d.scale) });
    } else if (d.type === "movecard") {
      onUpdateDoc(d.id, { canvasX: d.ix + (e.clientX - d.sx) / cam.z, canvasY: d.iy + (e.clientY - d.sy) / cam.z });
    } else if (d.type === "moveframe") {
      const dx = (e.clientX - d.sx) / cam.z;
      const dy = (e.clientY - d.sy) / cam.z;
      onUpdateFrame(d.id, { x: d.ix + dx, y: d.iy + dy });
      d.items.forEach(item => {
        if (item._itemType === "entry") onUpdateEntry(item.id, { ideaX: item.startX + dx, ideaY: item.startY + dy });
        else if (item._itemType === "doc") onUpdateDoc(item.id, { canvasX: item.startX + dx, canvasY: item.startY + dy });
      });
    } else if (d.type === "resizeframe") {
      const dx = (e.clientX - d.sx) / cam.z;
      const dy = (e.clientY - d.sy) / cam.z;
      const newW = Math.max(100, d.sw + dx);
      const newH = Math.max(60, d.sh + dy);
      const scaleX = newW / d.sw;
      const scaleY = newH / d.sh;
      onUpdateFrame(d.id, { w: newW, h: newH });
      d.items.forEach(item => {
        const uniformScale = Math.min(scaleX, scaleY);
        if (item._itemType === "entry") onUpdateEntry(item.id, { ideaX: d.fx + (item.startX - d.fx) * scaleX, ideaY: d.fy + (item.startY - d.fy) * scaleY, scale: item.startScale * uniformScale });
        else if (item._itemType === "doc") onUpdateDoc(item.id, { canvasX: d.fx + (item.startX - d.fx) * scaleX, canvasY: d.fy + (item.startY - d.fy) * scaleY, scale: item.startScale * uniformScale });
      });
    } else if (d.type === "newframe") {
      const rect = viewportRef.current.getBoundingClientRect();
      const cx = (e.clientX - rect.left - cam.x) / cam.z;
      const cy = (e.clientY - rect.top - cam.y) / cam.z;
      setFramePreview({ x: Math.min(d.sx, cx), y: Math.min(d.sy, cy), w: Math.abs(cx - d.sx), h: Math.abs(cy - d.sy) });
    }
  };

  const onPointerUp = () => {
    if (dragRef.current?.type === "newframe" && framePreview && framePreview.w > 40 && framePreview.h > 28) {
      onAddFrame({ x: framePreview.x, y: framePreview.y, w: framePreview.w, h: framePreview.h, label: "New Group", color: "#4a6fa5" });
      setMode("select");
    }
    dragRef.current = null;
    pinchRef.current = null;
    setFramePreview(null);
  };

  const onTouchStart = (ev) => {
    if (ev.touches.length === 2) {
      dragRef.current = null;
      const t1 = ev.touches[0], t2 = ev.touches[1];
      const cx = (t1.clientX + t2.clientX) / 2, cy = (t1.clientY + t2.clientY) / 2;
      pinchRef.current = { dist: Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY), cx, cy, camX: cam.x, camY: cam.y, camZ: cam.z };
    } else if (ev.touches.length === 1 && mode === "select") {
      dragRef.current = { type: "pan", startX: ev.touches[0].clientX, startY: ev.touches[0].clientY, camX: cam.x, camY: cam.y };
    }
  };

  const onTouchMove = (ev) => {
    if (ev.touches.length === 2 && pinchRef.current) {
      ev.preventDefault();
      const t1 = ev.touches[0], t2 = ev.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const cx = (t1.clientX + t2.clientX) / 2, cy = (t1.clientY + t2.clientY) / 2;
      const p = pinchRef.current;
      const newZ = Math.max(0.05, Math.min(p.camZ * (dist / p.dist), 4));
      // Zoom toward initial pinch center, then pan by how much the center has moved
      const canvasX = (p.cx - p.camX) / p.camZ;
      const canvasY = (p.cy - p.camY) / p.camZ;
      setCam({ z: newZ, x: cx - canvasX * newZ, y: cy - canvasY * newZ });
    } else if (dragRef.current) {
      ev.preventDefault();
      onPointerMove(ev.touches[0]);
    }
  };

  const onNoteDrag = (e, idea) => {
    if (mode === "connect") {
      e.stopPropagation();
      if (!connectFrom) { setConnectFrom(idea.id); return; }
      if (connectFrom !== idea.id) onAddConnection(connectFrom, idea.id);
      setConnectFrom(null); return;
    }
    if (mode === "draw" || mode === "erase") return;
    e.preventDefault(); e.stopPropagation();
    dragRef.current = { type: "move", id: idea.id, sx: e.clientX, sy: e.clientY, ix: idea.ideaX || 200, iy: idea.ideaY || 200 };
  };

  const onCardDrag = (e, doc) => {
    if (mode === "connect") {
      e.stopPropagation();
      if (!connectFrom) { setConnectFrom(doc.id); return; }
      if (connectFrom !== doc.id) onAddConnection(connectFrom, doc.id);
      setConnectFrom(null); return;
    }
    e.preventDefault(); e.stopPropagation();
    dragRef.current = { type: "movecard", id: doc.id, sx: e.clientX, sy: e.clientY, ix: doc.canvasX || 200, iy: doc.canvasY || 200 };
  };

  const onFrameDrag = (e, frame) => {
    e.preventDefault(); e.stopPropagation();
    dragRef.current = {
      type: "moveframe", id: frame.id, sx: e.clientX, sy: e.clientY, ix: frame.x, iy: frame.y,
      items: getItemsInFrame(frame).map(item => ({ id: item.id, _itemType: item._itemType, startX: item._posX, startY: item._posY }))
    };
  };

  const onFrameResizeDrag = (e, frame) => {
    e.preventDefault(); e.stopPropagation();
    dragRef.current = {
      type: "resizeframe", id: frame.id, sx: e.clientX, sy: e.clientY, sw: frame.w, sh: frame.h, fx: frame.x, fy: frame.y,
      items: getItemsInFrame(frame).map(item => ({ id: item.id, _itemType: item._itemType, startX: item._posX, startY: item._posY, startScale: item.scale || 1 }))
    };
  };

  const onResizeDrag = (e, idea) => {
    e.preventDefault(); e.stopPropagation();
    dragRef.current = { type: "resize", id: idea.id, sx: e.clientX, sy: e.clientY, sw: idea.width || 200, sh: idea.height || 140, scale: idea.scale || 1 };
  };

  const zoomToFit = () => {
    const allItems = [...activeIdeas, ...docCards.map(d => ({ ideaX: d.canvasX, ideaY: d.canvasY, width: d.canvasW || 240, height: 140 }))];
    if (!allItems.length) { setCam({ x: 0, y: 0, z: 1 }); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    allItems.forEach(item => {
      const x = item.ideaX ?? 200, y = item.ideaY ?? 200;
      const w = item.width ?? 200, h = item.height ?? 140;
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
    });
    const vw = viewportRef.current?.clientWidth || 800; const vh = viewportRef.current?.clientHeight || 600; const padding = 100;
    const newZ = Math.min(vw / (maxX - minX + padding * 2), vh / (maxY - minY + padding * 2), 1);
    setCam({ x: vw / 2 - ((minX + maxX) / 2) * newZ, y: vh / 2 - ((minY + maxY) / 2) * newZ, z: Math.max(0.05, newZ) });
  };

  const [currentStroke, setCurrentStroke] = useState(null);
  const onDrawPointerDown = (e) => {
    if (mode !== "draw" && mode !== "erase") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = viewportRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - cam.x) / cam.z; const y = (e.clientY - rect.top - cam.y) / cam.z;
    if (mode === "draw") setCurrentStroke({ color: drawColor, points: [[x, y]] });
    else {
      const filtered = bgStrokes.filter(s => { const pts = s.points || s; return !pts.some(p => Math.hypot(p[0] - x, p[1] - y) < 15 / cam.z); });
      if (filtered.length !== bgStrokes.length) onSetBgStrokes(filtered);
    }
  };
  const onDrawPointerMove = (e) => {
    if (mode === "draw" && currentStroke) {
      const rect = viewportRef.current.getBoundingClientRect();
      setCurrentStroke(s => ({ ...s, points: [...s.points, [(e.clientX - rect.left - cam.x) / cam.z, (e.clientY - rect.top - cam.y) / cam.z]] }));
    } else if (mode === "erase" && e.buttons === 1) {
      const rect = viewportRef.current.getBoundingClientRect();
      const px = (e.clientX - rect.left - cam.x) / cam.z; const py = (e.clientY - rect.top - cam.y) / cam.z;
      const filtered = bgStrokes.filter(s => { const pts = s.points || s; return !pts.some(p => Math.hypot(p[0] - px, p[1] - py) < 15 / cam.z); });
      if (filtered.length !== bgStrokes.length) onSetBgStrokes(filtered);
    }
  };
  const onDrawPointerUp = () => { if (currentStroke) { onSetBgStrokes([...bgStrokes, currentStroke]); setCurrentStroke(null); } };
  const allConnectable = useMemo(() => [
    ...activeIdeas.map(i => ({ ...i, itemType: "entry" })), 
    ...docCards.map(d => ({ ...d, itemType: "doc", ideaX: d.canvasX, ideaY: d.canvasY }))
  ], [activeIdeas, docCards]);

  return (
    <div
      ref={viewportRef}
      style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative", cursor: mode === "connect" || mode === "frame" ? "crosshair" : mode === "draw" ? "crosshair" : mode === "erase" ? "cell" : "default", touchAction: "none" }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp} onContextMenu={e => e.preventDefault()}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onPointerUp} onTouchCancel={onPointerUp}
    >
      {activeIdeas.length === 0 && docCards.length === 0 && !showArchive && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", color: "var(--text-tertiary)", pointerEvents: "none" }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>◈</div>
          <div style={{ fontFamily: "'Newsreader', serif", fontSize: 20 }}>No ideas yet</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, marginTop: 8 }}>Type in the dock below or mark entries as ◈ Idea</div>
        </div>
      )}

      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})`, transformOrigin: "0 0" }}>
        
        <FreehandArea 
          active={mode === "draw" || mode === "erase"} 
          tool={mode} 
          strokes={bgStrokes} 
          onStrokesChange={onSetBgStrokes} 
          drawColor={drawColor} 
          camScale={cam.z}
          style={{ position: "absolute", top: -10000, left: -10000, width: 20000, height: 20000, zIndex: 0, overflow: "visible" }}
        />

        {frames.map(frame => {
          const frameItems = getItemsInFrame(frame);
          return (
            <div key={frame.id} style={{ position: "absolute", left: frame.x, top: frame.y, width: frame.w, height: frame.h, border: `2px dashed ${frame.color}`, borderRadius: 12, background: `${frame.color}08`, pointerEvents: "all", zIndex: 1 }}>
              <div style={{ position: "absolute", top: -20, left: 12, display: "flex", alignItems: "center", gap: 4 }}>
                {editingFrameId === frame.id ? (
                  <input autoFocus defaultValue={frame.label} onBlur={e => { onUpdateFrame(frame.id, { label: e.target.value || "Group" }); setEditingFrameId(null); }} onKeyDown={e => { if (e.key === "Enter") { onUpdateFrame(frame.id, { label: e.target.value || "Group" }); setEditingFrameId(null); } }} style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, padding: "3px 10px", borderRadius: 6, border: `1.5px solid ${frame.color}`, background: "var(--bg-card)", color: "var(--text)", outline: "none", width: 120 }} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} />
                ) : (
                  <div onPointerDown={e => onFrameDrag(e, frame)} onDoubleClick={() => setEditingFrameId(frame.id)} style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, padding: "3px 12px", borderRadius: 6, background: "var(--bg-card)", border: `1.5px solid ${frame.color}`, color: frame.color, cursor: "move", userSelect: "none" }}>
                    {frame.label} ({frameItems.length})
                  </div>
                )}
                <button onClick={() => fitToFrame(frame)} onPointerDown={e => e.stopPropagation()} style={{ background: "none", border: "none", cursor: "pointer", color: frame.color, fontSize: 14, padding: "0 2px" }} title="Fit to frame">⛶</button>
                <button onClick={() => onRemoveFrame(frame.id)} onPointerDown={e => e.stopPropagation()} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16, padding: "0 2px" }}>×</button>
              </div>
              <div onPointerDown={e => onFrameResizeDrag(e, frame)} style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, cursor: "nwse-resize", display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 4, color: frame.color, opacity: 0.8 }}>◢</div>
            </div>
          );
        })}

        <svg style={{ position: "absolute", top: -10000, left: -10000, width: 20000, height: 20000, pointerEvents: "none", zIndex: 5, overflow: "visible" }}>
          <g transform="translate(10000, 10000)">
            {connections.map(c => {
              const from = allConnectable.find(i => i.id === c.fromId); 
              const to = allConnectable.find(i => i.id === c.toId);
              if (!from || !to) return null;
              const fp = getPos(from); const tp = getPos(to);
              const fScale = from.scale || 1; const tScale = to.scale || 1;
              const x1 = fp.left + ((from.width || from.canvasW || 220) * fScale) / 2; const y1 = fp.top + 30 * fScale; 
              const x2 = tp.left + ((to.width || to.canvasW || 220) * tScale) / 2; const y2 = tp.top + 30 * tScale;
              return (
                <g key={c.id}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c8b896" strokeWidth="1.5" strokeDasharray="5,4" opacity="0.6" />
                  {mode === "connect" && (
                    <g style={{ cursor: "pointer", pointerEvents: "all" }} onClick={() => onRemoveConnection(c.id)}>
                      <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r="10" fill="var(--bg-card)" stroke="var(--border)" />
                      <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 5} textAnchor="middle" fontSize="14" fill="var(--red)" style={{ fontFamily: "sans-serif", cursor: "pointer" }}>×</text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {activeIdeas.map(idea => {
          const pos = getPos(idea); 
          const iW = idea.width || 220; 
          const iH = idea.height || 160; 
          const isEditing = editingId === idea.id;
          const scale = idea.scale || 1; 
          
          return (
            <div 
              key={idea.id} 
              className={`inote ${connectFrom === idea.id ? "isel" : ""}`}
              style={{ left: pos.left, top: pos.top, width: iW, minHeight: idea.type === "sketch" ? iH : "auto", cursor: mode === "connect" ? "pointer" : "grab", zIndex: isEditing ? 100 : 10, transform: `scale(${scale})`, transformOrigin: "top left", background: idea.color ? `${idea.color}14` : "var(--bg-card)" }}
              onPointerDown={e => onNoteDrag(e, idea)}
            >
              <div className="inote-pin" style={{ background: idea.type === "sketch" ? "#7a5c8a" : "var(--amber)" }} />
              
              <div style={{ minHeight: 50 }}>
                {idea.type === "sketch" ? (
                  <div style={{ position: "relative", width: "100%", height: iH - 40, background: "rgba(255,255,255,0.35)", borderRadius: 4, marginBottom: 6 }}>
                    <FreehandArea active={isEditing} tool={isEditing ? sketchTool : "draw"} strokes={idea.strokes || []} camScale={cam.z * scale} onStrokesChange={s => onUpdateEntry(idea.id, { strokes: s })} drawColor={drawColor} />
                    <div onPointerDown={e => onResizeDrag(e, idea)} style={{ position: "absolute", bottom: 0, right: 0, width: 16, height: 16, cursor: "nwse-resize", opacity: 0.3 }}>◢</div>
                    
                    {isEditing && (
                      <div onPointerDown={e => e.stopPropagation()} style={{ position: "absolute", bottom: -46, right: 0, zIndex: 100, display: "flex", gap: 5, alignItems: "center", background: "var(--bg-card)", border: "1px solid var(--border)", padding: "5px 8px", borderRadius: 12, boxShadow: "var(--shadow-sm)" }}>
                        <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setSketchTool("draw"); }} style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, padding: "3px 10px", border: `1.5px solid ${sketchTool === "draw" ? "var(--text)" : "var(--border)"}`, borderRadius: 10, background: sketchTool === "draw" ? "var(--text)" : "transparent", color: sketchTool === "draw" ? "var(--bg-card)" : "var(--text-secondary)", cursor: "pointer" }}>✎ Draw</button>
                        <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setSketchTool("erase"); }} style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, padding: "3px 10px", border: `1.5px solid ${sketchTool === "erase" ? "var(--text)" : "var(--border)"}`, borderRadius: 10, background: sketchTool === "erase" ? "var(--text)" : "transparent", color: sketchTool === "erase" ? "var(--bg-card)" : "var(--text-secondary)", cursor: "pointer" }}>◻ Erase</button>
                        <div style={{ display: "flex", gap: 4 }}>
                          {PALETTE.map(hex => <button key={hex} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setDrawColor(hex); }} style={{ width: 14, height: 14, borderRadius: "50%", background: hex, border: drawColor === hex ? "2px solid var(--text)" : "2px solid transparent", cursor: "pointer" }} /> )}
                        </div>
                        <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setEditingId(null); setSketchTool("draw"); setMode("select"); }} style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, padding: "3px 10px", border: "1.5px solid #7a5c8a", borderRadius: 10, background: "#7a5c8a", color: "white", cursor: "pointer" }}>Done</button>
                      </div>
                    )}
                  </div>
                ) : isEditing ? (
                  <textarea 
                    ref={editRef} 
                    value={editingText} 
                    onChange={e => setEditingText(e.target.value)} 
                    onPointerDown={e => e.stopPropagation()} /* PREVENT NOTE DRAG */
                    onClick={e => e.stopPropagation()} 
                    onKeyDown={e => { if (e.key === "Escape") setEditingId(null); if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); onUpdateEntry(idea.id, { text: editingText.trim() }); setEditingId(null); } }} 
                    onBlur={() => { onUpdateEntry(idea.id, { text: editingText.trim() }); setEditingId(null); }} 
                    rows={3} 
                    style={{ width: "100%", border: "none", borderBottom: "1.5px solid var(--amber)", outline: "none", background: "transparent", fontFamily: "'Newsreader', serif", fontSize: 14, lineHeight: 1.6, color: "var(--text)", resize: "none" }} 
                  />
                ) : (
                  <div 
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingId(idea.id); setEditingText(idea.text); }}
                    style={{ fontFamily: "'Newsreader', serif", fontSize: 14, lineHeight: 1.6, color: "var(--text)", width: iW - 28 }}
                  >
                    <MarkdownContent text={idea.text} />
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border-light)" }}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif" }}>{formatTime(idea.ts)}</span>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <button onClick={() => onUpdateEntry(idea.id, { archived: true })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-tertiary)" }} title="Archive">⊙</button>
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setColorPickerId(colorPickerId === idea.id ? null : idea.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: idea.color || "var(--text-tertiary)", padding: 0 }}
                      title="Color"
                    >◉</button>
                    {colorPickerId === idea.id && (
                      <div
                        onPointerDown={e => e.stopPropagation()}
                        style={{ position: "absolute", bottom: 22, left: -28, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", display: "flex", gap: 4, boxShadow: "var(--shadow-md)", zIndex: 200 }}
                      >
                        <button onClick={(e) => { e.stopPropagation(); onUpdateEntry(idea.id, { color: null }); setColorPickerId(null); }} style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--bg)", border: "1.5px solid var(--border)", cursor: "pointer" }} title="None" />
                        {PALETTE.slice(0, 8).map(hex => (
                          <button key={hex} onClick={(e) => { e.stopPropagation(); onUpdateEntry(idea.id, { color: hex === idea.color ? null : hex }); setColorPickerId(null); }} style={{ width: 16, height: 16, borderRadius: "50%", background: hex, border: idea.color === hex ? "2.5px solid var(--text)" : "2px solid transparent", cursor: "pointer" }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={(e) => {
                    e.stopPropagation();
                    if (idea.type === "sketch") { setEditingId(idea.id); setMode("select"); setSketchTool("draw"); }
                    else { setEditingId(idea.id); setEditingText(idea.text); }
                  }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-tertiary)" }} title="Edit">✎</button>
                  <button onClick={() => onRemoveEntry(idea.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--red)" }}>×</button>
                </div>
              </div>
              
              {idea.type !== "sketch" && (
                <div onPointerDown={e => onResizeDrag(e, idea)} style={{ position: "absolute", bottom: 0, right: 0, width: 16, height: 16, cursor: "nwse-resize", opacity: 0.3 }}>◢</div>
              )}
            </div>
          );
        })}

        {docCards.map(doc => {
          const pos = getPos({ ideaX: doc.canvasX, ideaY: doc.canvasY });
          const preview = (doc.content || "").replace(/[#*`\[\]!\-]/g, "").slice(0, 80);
          const scale = doc.scale || 1;
          
          return (
            <div key={doc.id} onDoubleClick={() => openDoc && openDoc(doc.id)} style={{ position: "absolute", left: pos.left, top: pos.top, width: doc.canvasW || 240, background: "var(--bg-card)", border: connectFrom === doc.id ? "2px solid var(--accent)" : "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow-md)", cursor: mode === "connect" ? "pointer" : "grab", zIndex: 8, overflow: "hidden", transform: `scale(${scale})`, transformOrigin: "top left" }} onPointerDown={e => onCardDrag(e, doc)}>
              <div style={{ background: "var(--text)", color: "var(--bg)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, fontFamily: "'Inter', sans-serif" }}>
                <span style={{ opacity: 0.5, fontSize: 13 }}>≡</span>
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title || "Untitled"}</span>
                {/* JUMP TO DOC BUTTON */}
                {openDoc && (
                  <button 
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); openDoc(doc.id); }}
                    style={{ background: "none", border: "none", color: "var(--bg)", opacity: 0.6, cursor: "pointer", padding: "0 2px" }}
                    title="Open document"
                  >
                    ↗
                  </button>
                )}
              </div>
              {preview && <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif", lineHeight: 1.5, maxHeight: 60, overflow: "hidden" }}>{preview}...</div>}
              <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid var(--border-light)" }}>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif", flex: 1 }}>{formatShort(doc.updatedAt)}</span>
                {doc.tags?.slice(0, 2).map(t => <TagChip key={t} tag={t} size="sm" />)}
                <button onClick={() => onUpdateDoc(doc.id, { onCanvas: false })} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 13, padding: "0 2px" }} title="Remove from canvas">↙</button>
              </div>
            </div>
          );
        })}
      </div>

      {framePreview && framePreview.w > 8 && (
        <div style={{ position: "absolute", left: cam.x + framePreview.x * cam.z, top: cam.y + framePreview.y * cam.z, width: framePreview.w * cam.z, height: framePreview.h * cam.z, border: "2px dashed var(--accent)", borderRadius: 10, background: "rgba(74, 111, 165, 0.06)", pointerEvents: "none", zIndex: 3 }} />
      )}

      {/* Floating Dock */}
      <div style={{ position: "absolute", bottom: isMobile ? "auto" : 28, top: isMobile ? "50%" : "auto", right: isMobile ? 12 : "auto", left: isMobile ? "auto" : "50%", transform: isMobile ? "translateY(-50%)" : "translateX(-50%)", display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 8 : 4, alignItems: "center", background: "var(--bg-card)", backdropFilter: "blur(14px)", padding: isMobile ? "8px 4px" : "6px 10px", borderRadius: isMobile ? 24 : 28, border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", zIndex: 200, width: isMobile ? 46 : "auto" }}>
        {!isMobile && (
          <>
            <input 
              value={newIdea} 
              onChange={e => setNewIdea(e.target.value)} 
              onKeyDown={e => { 
                if (e.key === "Enter" && newIdea.trim()) { 
                  // Use onAddEntry here instead of onUpdateEntry!
                  onAddEntry({ 
                    text: newIdea.trim(), 
                    type: "idea", 
                    tags: [], 
                    ideaX: 300 - cam.x / cam.z + Math.random() * 100, 
                    ideaY: 300 - cam.y / cam.z + Math.random() * 100, 
                    width: 220, 
                    height: 160, 
                    strokes: [], 
                    archived: false 
                  }); 
                  setNewIdea(""); 
                } 
              }} 
              placeholder="+ Quick idea..." 
              style={{ 
                border: "none", 
                background: "transparent", 
                outline: "none", 
                fontFamily: "'Inter', sans-serif", 
                fontSize: 14, 
                color: "var(--text)", 
                width: 140, 
                padding: "4px 8px" 
              }} 
              onClick={e => e.stopPropagation()} 
              onPointerDown={e => e.stopPropagation()} 
            />
            <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
          </>
        )}
        
        {[ ["select", "↖", "Select"], ["draw", "✎", "Draw"], ["erase", "◻", "Erase"], ["connect", "⚯", "Link"], ["frame", "▭", "Frame"] ].map(([m, sym, label]) => (
          <button key={m} onClick={() => { setMode(m); setConnectFrom(null); }} style={{ padding: isMobile ? 0 : "6px 12px", justifyContent: "center", width: isMobile ? 34 : "auto", height: isMobile ? 34 : "auto", border: "none", borderRadius: isMobile ? "50%" : 20, background: mode === m ? "var(--text)" : "transparent", color: mode === m ? "var(--bg)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 14, display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s" }} title={label}>
            {sym} {!isMobile && <span style={{ fontSize: 11 }}>{label}</span>}
          </button>
        ))}
        
        <div style={{ width: isMobile ? 24 : 1, height: isMobile ? 1 : 20, background: "var(--border)", margin: isMobile ? "2px auto" : "0 4px" }} />
        <button onClick={zoomToFit} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14, padding: isMobile ? 0 : "6px 12px", width: isMobile ? 34 : "auto", height: isMobile ? 34 : "auto", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: isMobile ? "50%" : 20 }} title="Fit all">⛶</button>
        <button onClick={() => setShowArchive(!showArchive)} style={{ background: showArchive ? "var(--text)" : "transparent", color: showArchive ? "var(--bg)" : "var(--text-secondary)", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }} title="Archive">⊙</button>
        
        {mode === "draw" && (
          <div style={{ marginTop: isMobile ? 4 : 0, marginLeft: isMobile ? 0 : 4, display: "flex", flexDirection: isMobile ? "column" : "row", gap: 6 }}>
            <ColorPicker value={drawColor} onChange={setDrawColor} />
          </div>
        )}
      </div>

      {showArchive && (
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: isMobile ? "100%" : 280, background: "var(--bg-card)", borderLeft: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", zIndex: 150, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "'Inter', sans-serif" }}>
            <span style={{ fontWeight: 600, fontSize: 16 }}>⊙ Archive ({archivedIdeas.length})</span>
            <button onClick={() => setShowArchive(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-tertiary)" }}>×</button>
          </div>
          <div style={{ flex: 1, overflow: "auto" }}>
            {archivedIdeas.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", fontFamily: "'Newsreader', serif", fontSize: 16 }}>Nothing archived yet</div> : archivedIdeas.map(idea => (
              <div key={idea.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-light)" }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{idea.type === "sketch" ? "[Sketch]" : idea.text || "(empty)"}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "'Inter', sans-serif", flex: 1 }}>{formatTime(idea.ts)}</span>
                  <button title="Restore" onClick={() => onUpdateEntry(idea.id, { archived: false })} style={{ padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 14, fontFamily: "'Inter', sans-serif", color: "var(--text-secondary)" }}>{isMobile ? "↺" : "Restore"}</button>
                  <button title="Delete forever" onClick={() => onRemoveEntry(idea.id)} style={{ padding: "4px 8px", border: "1px solid var(--red)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 14, fontFamily: "'Inter', sans-serif", color: "var(--red)" }}>{isMobile ? "×" : "Delete"}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}