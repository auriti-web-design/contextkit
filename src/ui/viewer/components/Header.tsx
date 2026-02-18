import React from 'react';
import { SearchBar } from './SearchBar';

interface HeaderProps {
  isConnected: boolean;
  resolvedTheme: 'light' | 'dark';
  onThemeToggle: () => void;
}

export function Header({ isConnected, resolvedTheme, onThemeToggle }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-brand">
        <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
        <h1>Kiro Memory</h1>
      </div>

      <SearchBar />

      <div className="header-controls">
        <button
          className="theme-btn"
          onClick={onThemeToggle}
          title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {resolvedTheme === 'dark' ? '\u2600' : '\u263E'}
        </button>
      </div>
    </header>
  );
}
