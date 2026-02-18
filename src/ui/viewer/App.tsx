import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { Feed } from './components/Feed';
import { useSSE } from './hooks/useSSE';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';
import { Observation, Summary, UserPrompt } from './types';
import { mergeAndDeduplicateByProject } from './utils/data';

export function App() {
  const [currentFilter, setCurrentFilter] = useState('');
  const [paginatedObservations, setPaginatedObservations] = useState<Observation[]>([]);
  const [paginatedSummaries, setPaginatedSummaries] = useState<Summary[]>([]);
  const [paginatedPrompts, setPaginatedPrompts] = useState<UserPrompt[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { observations, summaries, prompts, projects, isConnected } = useSSE();
  const { settings, saveSettings } = useSettings();
  const { preference, resolvedTheme, setThemePreference } = useTheme();

  // Merge SSE live data with paginated data
  const allObservations = useMemo(() => {
    if (currentFilter) {
      return paginatedObservations;
    }
    return mergeAndDeduplicateByProject(observations, paginatedObservations);
  }, [observations, paginatedObservations, currentFilter]);

  const allSummaries = useMemo(() => {
    if (currentFilter) {
      return paginatedSummaries;
    }
    return mergeAndDeduplicateByProject(summaries, paginatedSummaries);
  }, [summaries, paginatedSummaries, currentFilter]);

  const allPrompts = useMemo(() => {
    if (currentFilter) {
      return paginatedPrompts;
    }
    return mergeAndDeduplicateByProject(prompts, paginatedPrompts);
  }, [prompts, paginatedPrompts, currentFilter]);

  // Load more data (pagination)
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

      if (obsRes.ok) {
        const newObs = await obsRes.json();
        setPaginatedObservations(prev => [...prev, ...newObs]);
      }
      if (sumRes.ok) {
        const newSum = await sumRes.json();
        setPaginatedSummaries(prev => [...prev, ...newSum]);
      }
      if (promptRes.ok) {
        const newPrompts = await promptRes.json();
        setPaginatedPrompts(prev => [...prev, ...newPrompts]);
      }
    } catch (error) {
      console.error('Failed to load more data:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentFilter, paginatedObservations.length, isLoadingMore]);

  // Reset and load first page when filter changes
  useEffect(() => {
    setPaginatedObservations([]);
    setPaginatedSummaries([]);
    setPaginatedPrompts([]);
    handleLoadMore();
  }, [currentFilter]);

  return (
    <div className="app" data-theme={resolvedTheme}>
      <Header
        isConnected={isConnected}
        projects={projects}
        currentFilter={currentFilter}
        onFilterChange={setCurrentFilter}
        themePreference={preference}
        onThemeChange={setThemePreference}
      />

      <Feed
        observations={allObservations}
        summaries={allSummaries}
        prompts={allPrompts}
        onLoadMore={handleLoadMore}
        isLoading={isLoadingMore}
        hasMore={true}
      />
    </div>
  );
}
