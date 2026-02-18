import { useState, useEffect, useCallback } from 'react';
import { Observation, Summary, UserPrompt } from '../types';

interface SSEState {
  observations: Observation[];
  summaries: Summary[];
  prompts: UserPrompt[];
  projects: string[];
  isConnected: boolean;
}

export function useSSE(): SSEState {
  const [state, setState] = useState<SSEState>({
    observations: [],
    summaries: [],
    prompts: [],
    projects: [],
    isConnected: false
  });

  useEffect(() => {
    const eventSource = new EventSource('/events');

    eventSource.onopen = () => {
      setState(prev => ({ ...prev, isConnected: true }));
    };

    eventSource.onerror = () => {
      setState(prev => ({ ...prev, isConnected: false }));
    };

    eventSource.addEventListener('observation-created', (event) => {
      const data = JSON.parse(event.data);
      // Fetch updated observations
      fetchObservations();
    });

    eventSource.addEventListener('summary-created', (event) => {
      const data = JSON.parse(event.data);
      // Fetch updated summaries
      fetchSummaries();
    });

    const fetchObservations = async () => {
      try {
        const res = await fetch('/api/observations?limit=50');
        if (res.ok) {
          const observations = await res.json();
          setState(prev => ({ ...prev, observations }));
        }
      } catch (error) {
        console.error('Failed to fetch observations:', error);
      }
    };

    const fetchSummaries = async () => {
      try {
        const res = await fetch('/api/summaries?limit=20');
        if (res.ok) {
          const summaries = await res.json();
          setState(prev => ({ ...prev, summaries }));
        }
      } catch (error) {
        console.error('Failed to fetch summaries:', error);
      }
    };

    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const projects = await res.json();
          setState(prev => ({ ...prev, projects }));
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      }
    };

    // Initial fetch
    fetchObservations();
    fetchSummaries();
    fetchProjects();

    return () => {
      eventSource.close();
    };
  }, []);

  return state;
}
