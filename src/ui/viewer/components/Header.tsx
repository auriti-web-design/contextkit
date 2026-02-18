import React from 'react';
import { ThemePreference } from '../types';

interface HeaderProps {
  isConnected: boolean;
  projects: string[];
  currentFilter: string;
  onFilterChange: (filter: string) => void;
  themePreference: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}

export function Header({
  isConnected,
  projects,
  currentFilter,
  onFilterChange,
  themePreference,
  onThemeChange
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <h1>ContextKit</h1>
        <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="header-center">
        <select
          value={currentFilter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="project-filter"
        >
          <option value="">All Projects</option>
          {projects.map(project => (
            <option key={project} value={project}>{project}</option>
          ))}
        </select>
      </div>

      <div className="header-right">
        <select
          value={themePreference}
          onChange={(e) => onThemeChange(e.target.value as ThemePreference)}
          className="theme-selector"
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
    </header>
  );
}
