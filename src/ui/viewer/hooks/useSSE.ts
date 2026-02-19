import { useState, useEffect, useRef } from 'react';
import { Observation, Summary, UserPrompt } from '../types';

interface SSEState {
  observations: Observation[];
  summaries: Summary[];
  prompts: UserPrompt[];
  projects: string[];
  isConnected: boolean;
}

/**
 * Hook SSE con auto-reconnect e fetch iniziale completo.
 */
export function useSSE(): SSEState {
  const [state, setState] = useState<SSEState>({
    observations: [],
    summaries: [],
    prompts: [],
    projects: [],
    isConnected: false
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let eventSource: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const MAX_RETRY_DELAY = 30000;

    /* ── Fetch helpers ── */
    const fetchObservations = async () => {
      try {
        const res = await fetch('/api/observations?limit=50');
        if (res.ok && mountedRef.current) {
          const observations = await res.json();
          setState(prev => ({ ...prev, observations }));
        }
      } catch (err) {
        console.error('Failed to fetch observations:', err);
      }
    };

    const fetchSummaries = async () => {
      try {
        const res = await fetch('/api/summaries?limit=20');
        if (res.ok && mountedRef.current) {
          const summaries = await res.json();
          setState(prev => ({ ...prev, summaries }));
        }
      } catch (err) {
        console.error('Failed to fetch summaries:', err);
      }
    };

    const fetchPrompts = async () => {
      try {
        const res = await fetch('/api/prompts?limit=50');
        if (res.ok && mountedRef.current) {
          const prompts = await res.json();
          setState(prev => ({ ...prev, prompts }));
        }
      } catch (err) {
        console.error('Failed to fetch prompts:', err);
      }
    };

    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/projects');
        if (res.ok && mountedRef.current) {
          const projects = await res.json();
          setState(prev => ({ ...prev, projects }));
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    };

    /* ── SSE con exponential backoff ── */
    const connect = () => {
      if (!mountedRef.current) return;

      eventSource = new EventSource('/events');

      eventSource.onopen = () => {
        if (!mountedRef.current) return;
        retryCount = 0;
        setState(prev => ({ ...prev, isConnected: true }));
      };

      eventSource.onerror = () => {
        if (!mountedRef.current) return;
        setState(prev => ({ ...prev, isConnected: false }));

        eventSource?.close();
        eventSource = null;

        const delay = Math.min(1000 * Math.pow(2, retryCount), MAX_RETRY_DELAY);
        retryCount++;
        retryTimeout = setTimeout(connect, delay);
      };

      eventSource.addEventListener('observation-created', () => {
        fetchObservations();
        fetchProjects();
      });

      eventSource.addEventListener('summary-created', () => {
        fetchSummaries();
      });

      eventSource.addEventListener('prompt-created', () => {
        fetchPrompts();
      });
    };

    // Fetch iniziale di tutti i dati
    fetchObservations();
    fetchSummaries();
    fetchPrompts();
    fetchProjects();

    // Avvia connessione SSE
    connect();

    return () => {
      mountedRef.current = false;
      eventSource?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);

  return state;
}
