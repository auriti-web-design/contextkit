import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Feed } from './components/Feed';
import { useSSE } from './hooks/useSSE';
import { useTheme } from './hooks/useTheme';
import { Observation, Summary, UserPrompt } from './types';
import { mergeAndDeduplicateByProject } from './utils/data';

// Tipi di osservazione per i filtri
const TYPE_FILTERS = ['file-write', 'command', 'research', 'delegation', 'tool-use'] as const;

export function App() {
  const [currentFilter, setCurrentFilter] = useState('');
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(TYPE_FILTERS));
  const [paginatedObservations, setPaginatedObservations] = useState<Observation[]>([]);
  const [paginatedSummaries, setPaginatedSummaries] = useState<Summary[]>([]);
  const [paginatedPrompts, setPaginatedPrompts] = useState<UserPrompt[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const { observations, summaries, prompts, projects, isConnected } = useSSE();
  const { resolvedTheme, setThemePreference } = useTheme();

  // Merge dati SSE live con dati paginati
  const allObservations = useMemo(() => {
    if (currentFilter) return paginatedObservations;
    return mergeAndDeduplicateByProject(observations, paginatedObservations);
  }, [observations, paginatedObservations, currentFilter]);

  const allSummaries = useMemo(() => {
    if (currentFilter) return paginatedSummaries;
    return mergeAndDeduplicateByProject(summaries, paginatedSummaries);
  }, [summaries, paginatedSummaries, currentFilter]);

  const allPrompts = useMemo(() => {
    if (currentFilter) return paginatedPrompts;
    return mergeAndDeduplicateByProject(prompts, paginatedPrompts);
  }, [prompts, paginatedPrompts, currentFilter]);

  // Filtra per tipo attivo
  const filteredObservations = useMemo(() =>
    allObservations.filter(o => activeTypes.has(o.type)),
    [allObservations, activeTypes]
  );

  // Statistiche
  const stats = useMemo(() => ({
    observations: allObservations.length,
    summaries: allSummaries.length,
    prompts: allPrompts.length
  }), [allObservations, allSummaries, allPrompts]);

  // Toggle filtro tipo
  const toggleType = useCallback((type: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  // Caricamento paginato
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);

    try {
      const offset = paginatedObservations.length;
      const limit = 20;
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(limit),
        ...(currentFilter && { project: currentFilter })
      });

      const [obsRes, sumRes, promptRes] = await Promise.all([
        fetch(`/api/observations?${params}`),
        fetch(`/api/summaries?${params}`),
        fetch(`/api/prompts?${params}`)
      ]);

      let newItems = 0;

      if (obsRes.ok) {
        const newObs = await obsRes.json();
        newItems += newObs.length;
        setPaginatedObservations(prev => [...prev, ...newObs]);
      }
      if (sumRes.ok) {
        const newSum = await sumRes.json();
        newItems += newSum.length;
        setPaginatedSummaries(prev => [...prev, ...newSum]);
      }
      if (promptRes.ok) {
        const newPrompts = await promptRes.json();
        newItems += newPrompts.length;
        setPaginatedPrompts(prev => [...prev, ...newPrompts]);
      }

      // Se non ci sono nuovi risultati, non ci sono più dati
      if (newItems === 0) setHasMore(false);
    } catch (error) {
      console.error('Errore caricamento dati:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentFilter, paginatedObservations.length, isLoadingMore]);

  // Reset quando cambia il filtro progetto
  useEffect(() => {
    setPaginatedObservations([]);
    setPaginatedSummaries([]);
    setPaginatedPrompts([]);
    setHasMore(true);
  }, [currentFilter]);

  return (
    <div className="app" data-theme={resolvedTheme}>
      <Header
        isConnected={isConnected}
        resolvedTheme={resolvedTheme}
        onThemeToggle={() => setThemePreference(resolvedTheme === 'dark' ? 'light' : 'dark')}
      />

      <Sidebar
        projects={projects}
        currentFilter={currentFilter}
        onFilterChange={setCurrentFilter}
        activeTypes={activeTypes}
        onToggleType={toggleType}
        stats={stats}
      />

      <div className="main">
        <Feed
          observations={filteredObservations}
          summaries={allSummaries}
          prompts={allPrompts}
          onLoadMore={handleLoadMore}
          isLoading={isLoadingMore}
          hasMore={hasMore}
        />
      </div>
    </div>
  );
}
