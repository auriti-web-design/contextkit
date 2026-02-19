import { useState, useEffect, useCallback } from 'react';
import { ProjectAlias } from '../types';

interface UseProjectAliasesReturn {
  aliases: Record<string, string>;
  getDisplayName: (project: string) => string;
  updateAlias: (project: string, displayName: string) => Promise<void>;
  isLoading: boolean;
}

/**
 * Hook per gestione alias dei progetti.
 * Mappa project_name → display_name con fallback al nome originale.
 */
export function useProjectAliases(): UseProjectAliasesReturn {
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Fetch alias dal backend
  useEffect(() => {
    const fetchAliases = async () => {
      try {
        const res = await fetch('/api/project-aliases');
        if (res.ok) {
          const data = await res.json();
          setAliases(data);
        }
      } catch (err) {
        console.error('Failed to fetch project aliases:', err);
      }
    };
    fetchAliases();
  }, []);

  // Restituisce display_name o fallback al project_name
  const getDisplayName = useCallback((project: string): string => {
    return aliases[project] || project;
  }, [aliases]);

  // Aggiorna un alias
  const updateAlias = useCallback(async (project: string, displayName: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/project-aliases/${encodeURIComponent(project)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName })
      });

      if (res.ok) {
        setAliases(prev => ({ ...prev, [project]: displayName }));
      }
    } catch (err) {
      console.error('Failed to update project alias:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { aliases, getDisplayName, updateAlias, isLoading };
}
