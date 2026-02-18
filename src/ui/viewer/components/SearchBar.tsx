import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Observation, Summary } from '../types';
import { getBadgeClass, timeAgo } from '../utils/format';

interface SearchResult {
  observations: Observation[];
  summaries: Summary[];
}

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Ricerca con debounce
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Ricerca fallita:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }, [doSearch]);

  // Shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Chiudi dropdown quando si clicca fuori
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const totalResults = results
    ? results.observations.length + results.summaries.length
    : 0;

  return (
    <div className="search-container" ref={containerRef}>
      <div className="search-input-wrapper">
        <svg className="search-icon" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search observations, summaries..."
          value={query}
          onChange={handleChange}
          onFocus={() => { if (results && totalResults > 0) setIsOpen(true); }}
        />
        <span className="search-shortcut">{navigator.platform.includes('Mac') ? '\u2318K' : 'Ctrl+K'}</span>
      </div>

      {isOpen && results && (
        <div className="search-results">
          {totalResults === 0 && !isSearching && (
            <div className="search-empty">No results for &ldquo;{query}&rdquo;</div>
          )}

          {results.observations.map(obs => (
            <div key={`obs-${obs.id}`} className="search-result-item">
              <span className={`badge ${getBadgeClass(obs.type)}`}>{obs.type}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="search-result-title">{obs.title}</div>
                {obs.text && <div className="search-result-snippet">{obs.text.substring(0, 120)}</div>}
                <div className="search-result-meta">{obs.project} &middot; {timeAgo(obs.created_at_epoch)}</div>
              </div>
            </div>
          ))}

          {results.summaries.map(sum => (
            <div key={`sum-${sum.id}`} className="search-result-item">
              <span className="badge badge--summary">summary</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="search-result-title">{sum.request || 'Session Summary'}</div>
                {sum.completed && <div className="search-result-snippet">{sum.completed.substring(0, 120)}</div>}
                <div className="search-result-meta">{sum.project} &middot; {timeAgo(sum.created_at_epoch)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
