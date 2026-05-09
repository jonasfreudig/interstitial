import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { generateId } from "../utils/helpers";
import { extractLinks, processBidirectionalLinks } from "../utils/links";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [entries, setEntries] = useState([]);
  const [docs, setDocs] = useState([]);
  const [connections, setConnections] = useState([]);
  const [frames, setFrames] = useState([]);
  const [bgStrokes, setBgStrokes] = useState([]);

  // ---- Derived Data ----
  const allTags = useMemo(() => {
    const tags = new Set();
    entries.forEach(e => (e.tags || []).forEach(t => tags.add(t)));
    docs.forEach(d => (d.tags || []).forEach(t => tags.add(t)));
    return [...tags].sort();
  }, [entries, docs]);

  // ---- Entry Operations ----
  const addEntry = useCallback((entryData) => {
    const entry = {
      id: generateId(),
      ts: Date.now(),
      text: entryData.text || "",
      type: entryData.type || "note",
      done: entryData.type === "task" ? false : undefined,
      kanban: entryData.type === "task" ? (entryData.kanban || "backlog") : undefined,
      priority: entryData.type === "task" ? (entryData.priority || null) : undefined,
      deadline: entryData.type === "task" ? (entryData.deadline || null) : undefined,
      tags: entryData.tags || [],
      color: entryData.color || null,
      linkedDocs: entryData.linkedDocs || [],
      // Canvas positioning
      ideaX: entryData.ideaX || 200 + Math.random() * 200,
      ideaY: entryData.ideaY || 200 + Math.random() * 200,
      width: entryData.width || 220,
      height: entryData.height || 160,
      strokes: entryData.strokes || [],
      archived: false,
    };
    
    // Process inline links in text
    if (entry.text) {
      const links = extractLinks(entry.text);
      links.forEach(link => {
        const matchedDoc = docs.find(d => 
          d.title?.toLowerCase().includes(link.query.toLowerCase())
        );
        if (matchedDoc && !entry.linkedDocs.includes(matchedDoc.id)) {
          entry.linkedDocs.push(matchedDoc.id);
        }
      });
    }
    
    setEntries(prev => [entry, ...prev]);
    return entry;
  }, [docs]);

  const updateEntry = useCallback((id, updates) => {
    setEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      
      const updated = { ...e, ...updates };
      
      // Re-process links if text changed
      if (updates.text) {
        const links = extractLinks(updates.text);
        const newLinkedDocs = [...(e.linkedDocs || [])];
        links.forEach(link => {
          const matchedDoc = docs.find(d => 
            d.title?.toLowerCase().includes(link.query.toLowerCase())
          );
          if (matchedDoc && !newLinkedDocs.includes(matchedDoc.id)) {
            newLinkedDocs.push(matchedDoc.id);
          }
        });
        updated.linkedDocs = newLinkedDocs;
      }
      
      return updated;
    }));
  }, [docs]);

  const removeEntry = useCallback((id) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    setConnections(prev => prev.filter(c => c.fromId !== id && c.toId !== id));
  }, []);

  // ---- Doc Operations ----
  const addDoc = useCallback((docData) => {
    const doc = {
      id: generateId(),
      ts: Date.now(),
      updatedAt: Date.now(),
      title: docData.title || "",
      content: docData.content || "",
      tags: docData.tags || [],
      linkedEntryIds: docData.linkedEntryIds || [],
      linkedDocIds: docData.linkedDocIds || [],
      onCanvas: docData.onCanvas || false,
      canvasX: docData.canvasX || 200,
      canvasY: docData.canvasY || 200,
      canvasW: docData.canvasW || 240,
    };
    
    // Process inline links
    if (doc.content) {
      const links = extractLinks(doc.content);
      links.forEach(link => {
        // Check entries
        const matchedEntry = entries.find(e => 
          e.text?.toLowerCase().includes(link.query.toLowerCase())
        );
        if (matchedEntry && !doc.linkedEntryIds.includes(matchedEntry.id)) {
          doc.linkedEntryIds.push(matchedEntry.id);
        }
        // Check other docs
        const matchedDoc = docs.find(d => 
          d.id !== doc.id && d.title?.toLowerCase().includes(link.query.toLowerCase())
        );
        if (matchedDoc && !doc.linkedDocIds.includes(matchedDoc.id)) {
          doc.linkedDocIds.push(matchedDoc.id);
        }
      });
    }
    
    setDocs(prev => [...prev, doc]);
    return doc;
  }, [entries, docs]);

  const updateDoc = useCallback((id, updates) => {
    setDocs(prev => prev.map(d => {
      if (d.id !== id) return d;
      
      const updated = { ...d, ...updates, updatedAt: Date.now() };
      
      // Re-process links if content changed
      if (updates.content) {
        const links = extractLinks(updates.content);
        const newLinkedEntries = [...(d.linkedEntryIds || [])];
        const newLinkedDocs = [...(d.linkedDocIds || [])];
        
        links.forEach(link => {
          const matchedEntry = entries.find(e => 
            e.text?.toLowerCase().includes(link.query.toLowerCase())
          );
          if (matchedEntry && !newLinkedEntries.includes(matchedEntry.id)) {
            newLinkedEntries.push(matchedEntry.id);
          }
          
          const matchedDoc = docs.find(doc => 
            doc.id !== d.id && doc.title?.toLowerCase().includes(link.query.toLowerCase())
          );
          if (matchedDoc && !newLinkedDocs.includes(matchedDoc.id)) {
            newLinkedDocs.push(matchedDoc.id);
          }
        });
        
        updated.linkedEntryIds = newLinkedEntries;
        updated.linkedDocIds = newLinkedDocs;
      }
      
      return updated;
    }));
  }, [entries, docs]);

  const deleteDoc = useCallback((id) => {
    setDocs(prev => prev.filter(d => d.id !== id));
    // Remove doc references from entries
    setEntries(prev => prev.map(e => ({
      ...e,
      linkedDocs: (e.linkedDocs || []).filter(docId => docId !== id)
    })));
  }, []);

  // ---- Link Operations ----
  const linkEntryToDoc = useCallback((entryId, docId) => {
    // Add doc to entry
    setEntries(prev => prev.map(e => {
      if (e.id !== entryId) return e;
      const linkedDocs = e.linkedDocs || [];
      if (linkedDocs.includes(docId)) return e;
      return { ...e, linkedDocs: [...linkedDocs, docId] };
    }));
    
    // Add entry to doc
    setDocs(prev => prev.map(d => {
      if (d.id !== docId) return d;
      const linkedEntryIds = d.linkedEntryIds || [];
      if (linkedEntryIds.includes(entryId)) return d;
      return { ...d, linkedEntryIds: [...linkedEntryIds, entryId] };
    }));
  }, []);

  const unlinkEntryFromDoc = useCallback((entryId, docId) => {
    setEntries(prev => prev.map(e => ({
      ...e,
      linkedDocs: (e.linkedDocs || []).filter(id => id !== docId)
    })));
    setDocs(prev => prev.map(d => ({
      ...d,
      linkedEntryIds: (d.linkedEntryIds || []).filter(id => id !== entryId)
    })));
  }, []);

  // ---- Connection Operations ----
  const addConnection = useCallback((fromId, toId) => {
    if (fromId === toId) return;
    const exists = connections.find(c => 
      (c.fromId === fromId && c.toId === toId) || 
      (c.fromId === toId && c.toId === fromId)
    );
    if (exists) return;
    
    setConnections(prev => [...prev, {
      id: generateId(),
      fromId,
      toId,
      ts: Date.now()
    }]);
  }, [connections]);

  const removeConnection = useCallback((id) => {
    setConnections(prev => prev.filter(c => c.id !== id));
  }, []);

  // ---- Frame Operations ----
  const addFrame = useCallback((frameData) => {
    const frame = {
      id: generateId(),
      x: frameData.x || 200,
      y: frameData.y || 200,
      w: frameData.w || 400,
      h: frameData.h || 300,
      label: frameData.label || "Group",
      color: frameData.color || "#4a6fa5",
      collapsed: false,
    };
    setFrames(prev => [...prev, frame]);
    return frame;
  }, []);

  const updateFrame = useCallback((id, updates) => {
    setFrames(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const removeFrame = useCallback((id) => {
    setFrames(prev => prev.filter(f => f.id !== id));
  }, []);

  // ---- Process all bidirectional links ----
  const processAllLinks = useCallback((entries, docs) => {
    return processBidirectionalLinks(entries, docs);
  }, []);

  const value = {
    entries, setEntries,
    docs, setDocs,
    connections, setConnections,
    frames, setFrames,
    bgStrokes, setBgStrokes,
    allTags,
    addEntry, updateEntry, removeEntry,
    addDoc, updateDoc, deleteDoc,
    linkEntryToDoc, unlinkEntryFromDoc,
    addConnection, removeConnection,
    addFrame, updateFrame, removeFrame,
    processAllLinks,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return context;
}