// ---- Link Regex & Extraction ----
export const LINK_REGEX = /\[\[([^\]]+)\]\]/g;
export const ENTRY_LINK_REGEX = /\[entry:([^\]]+)\]/g;
export const DOC_LINK_REGEX = /\[doc:([^\]]+)\]/g;

export function extractLinks(text) {
  if (!text) return [];
  
  const links = [];
  let match;
  const regex = new RegExp(LINK_REGEX);
  
  while ((match = regex.exec(text)) !== null) {
    links.push({
      raw: match[0],
      query: match[1].trim(),
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  return links;
}

// ---- Link Resolution ----
export function resolveLinks(text, entries, docs) {
  if (!text) return text;
  
  let resolved = text;
  const links = extractLinks(text);
  
  links.forEach(link => {
    // Try to match with an entry
    const matchedEntry = entries.find(e => 
      e.text?.toLowerCase().includes(link.query.toLowerCase())
    );
    
    if (matchedEntry) {
      resolved = resolved.replace(
        link.raw, 
        `[${link.query}](entry:${matchedEntry.id})`
      );
      return;
    }
    
    // Try to match with a doc
    const matchedDoc = docs.find(d => 
      d.title?.toLowerCase().includes(link.query.toLowerCase())
    );
    
    if (matchedDoc) {
      resolved = resolved.replace(
        link.raw, 
        `[${link.query}](doc:${matchedDoc.id})`
      );
    }
  });
  
  return resolved;
}

// ---- Bidirectional Link Processing ----
export function processBidirectionalLinks(entries, docs) {
  const linkMap = {};
  
  // Initialize map for all entries
  entries.forEach(e => {
    linkMap[e.id] = {
      entryId: e.id,
      docs: [],
      otherEntries: [],
      count: 0
    };
  });
  
  // Process doc -> entry links
  docs.forEach(doc => {
    // Explicit linked entries
    (doc.linkedEntryIds || []).forEach(entryId => {
      if (linkMap[entryId]) {
        linkMap[entryId].docs.push({
          id: doc.id,
          title: doc.title || "Untitled",
          type: "explicit"
        });
        linkMap[entryId].count++;
      }
    });
    
    // Inline links in doc content
    if (doc.content) {
      const links = extractLinks(doc.content);
      links.forEach(link => {
        const matchedEntry = entries.find(e => 
          e.text?.toLowerCase().includes(link.query.toLowerCase())
        );
        if (matchedEntry && linkMap[matchedEntry.id]) {
          // Check if already added via explicit link
          const alreadyLinked = linkMap[matchedEntry.id].docs
            .some(d => d.id === doc.id);
          
          if (!alreadyLinked) {
            linkMap[matchedEntry.id].docs.push({
              id: doc.id,
              title: doc.title || "Untitled",
              type: "inline"
            });
            linkMap[matchedEntry.id].count++;
          }
        }
      });
    }
  });
  
  // Process entry -> doc links
  entries.forEach(entry => {
    if (entry.linkedDocs) {
      entry.linkedDocs.forEach(docId => {
        const doc = docs.find(d => d.id === docId);
        if (doc && linkMap[entry.id]) {
          const alreadyLinked = linkMap[entry.id].docs
            .some(d => d.id === docId);
          
          if (!alreadyLinked) {
            linkMap[entry.id].docs.push({
              id: doc.id,
              title: doc.title || "Untitled",
              type: "entry-link"
            });
            linkMap[entry.id].count++;
          }
        }
      });
    }
    
    // Inline doc links in entry text
    if (entry.text) {
      const links = extractLinks(entry.text);
      links.forEach(link => {
        const matchedDoc = docs.find(d => 
          d.title?.toLowerCase().includes(link.query.toLowerCase())
        );
        if (matchedDoc && linkMap[entry.id]) {
          const alreadyLinked = linkMap[entry.id].docs
            .some(d => d.id === matchedDoc.id);
          
          if (!alreadyLinked) {
            linkMap[entry.id].docs.push({
              id: matchedDoc.id,
              title: matchedDoc.title || "Untitled",
              type: "inline-entry"
            });
            linkMap[entry.id].count++;
          }
        }
      });
    }
  });
  
  return linkMap;
}

// ---- Link Autocomplete ----
export function getLinkSuggestions(query, entries, docs, excludeIds = []) {
  if (!query || query.length < 1) return [];
  
  const q = query.toLowerCase();
  const results = [];
  
  // Search entries
  entries.forEach(entry => {
    if (excludeIds.includes(entry.id)) return;
    if (entry.type === "sketch") return;
    
    const textMatch = entry.text?.toLowerCase().includes(q);
    const tagMatch = entry.tags?.some(t => t.toLowerCase().includes(q));
    
    if (textMatch || tagMatch) {
      results.push({
        type: "entry",
        id: entry.id,
        title: (entry.text || "").slice(0, 60) + (entry.text?.length > 60 ? "..." : ""),
        entryType: entry.type,
        matchScore: textMatch ? 2 : 1,
        tags: entry.tags || []
      });
    }
  });
  
  // Search docs
  docs.forEach(doc => {
    if (excludeIds.includes(doc.id)) return;
    
    const titleMatch = doc.title?.toLowerCase().includes(q);
    const contentMatch = doc.content?.toLowerCase().includes(q);
    const tagMatch = doc.tags?.some(t => t.toLowerCase().includes(q));
    
    if (titleMatch || contentMatch || tagMatch) {
      results.push({
        type: "doc",
        id: doc.id,
        title: doc.title || "Untitled",
        matchScore: titleMatch ? 3 : (contentMatch ? 2 : 1),
        tags: doc.tags || []
      });
    }
  });
  
  // Sort by match score
  results.sort((a, b) => b.matchScore - a.matchScore);
  
  return results.slice(0, 8);
}

// ---- Link Rendering ----
export function renderContentWithLinks(text, linkMap, onLinkClick) {
  if (!text) return text;
  
  const parts = [];
  let lastIndex = 0;
  const regex = new RegExp(LINK_REGEX);
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before link
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.slice(lastIndex, match.index)
      });
    }
    
    // Add link
    const link = {
      type: "link",
      query: match[1],
      raw: match[0],
      resolved: resolveLinkQuery(match[1], linkMap)
    };
    parts.push(link);
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.slice(lastIndex)
    });
  }
  
  return parts;
}

function resolveLinkQuery(query, linkMap) {
  // Check if query matches any entry title
  const entries = Object.values(linkMap);
  const q = query.toLowerCase();
  
  for (const entry of entries) {
    if (entry.text?.toLowerCase().includes(q)) {
      return { type: "entry", id: entry.entryId, label: entry.text.slice(0, 50) };
    }
  }
  
  // Check if query matches any doc title
  // (We'd need docs data here, so this is a simplified version)
  
  return null;
}

// ---- Create Wiki Link ----
export function createWikiLink(text) {
  return `[[${text}]]`;
}

// ---- Parse Wiki Links for Display ----
export function parseWikiLinksForDisplay(text, entries, docs) {
  return text.replace(LINK_REGEX, (match, query) => {
    const entry = entries.find(e => 
      e.text?.toLowerCase().includes(query.toLowerCase())
    );
    if (entry) {
      return `[${query}](entry:${entry.id})`;
    }
    
    const doc = docs.find(d => 
      d.title?.toLowerCase().includes(query.toLowerCase())
    );
    if (doc) {
      return `[${query}](doc:${doc.id})`;
    }
    
    return match;
  });
}