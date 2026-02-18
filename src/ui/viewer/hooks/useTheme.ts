import { useState, useEffect } from 'react';
import { ThemePreference } from '../types';

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = localStorage.getItem('kiro-memory-theme') as ThemePreference;
    if (saved) {
      setPreference(saved);
    }
  }, []);

  useEffect(() => {
    const resolveTheme = () => {
      if (preference === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setResolvedTheme(prefersDark ? 'dark' : 'light');
      } else {
        setResolvedTheme(preference);
      }
    };

    resolveTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (preference === 'system') {
        setResolvedTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [preference]);

  const setThemePreference = (theme: ThemePreference) => {
    setPreference(theme);
    localStorage.setItem('kiro-memory-theme', theme);
  };

  return { preference, resolvedTheme, setThemePreference };
}
