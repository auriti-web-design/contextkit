import React from 'react';

// Mappa tipo → colore CSS per i dot
const TYPE_COLORS: Record<string, string> = {
  'file-write': 'var(--green)',
  'command': 'var(--amber)',
  'research': 'var(--blue)',
  'delegation': 'var(--accent)',
  'tool-use': 'var(--text-muted)'
};

interface SidebarProps {
  projects: string[];
  currentFilter: string;
  onFilterChange: (project: string) => void;
  activeTypes: Set<string>;
  onToggleType: (type: string) => void;
  stats: { observations: number; summaries: number; prompts: number };
}

export function Sidebar({
  projects,
  currentFilter,
  onFilterChange,
  activeTypes,
  onToggleType,
  stats
}: SidebarProps) {
  return (
    <aside className="sidebar">
      {/* Progetti */}
      <div className="sidebar-section">
        <div className="sidebar-title">Projects</div>
        <div
          className={`sidebar-item ${currentFilter === '' ? 'active' : ''}`}
          onClick={() => onFilterChange('')}
        >
          All Projects
        </div>
        {projects.map(project => (
          <div
            key={project}
            className={`sidebar-item ${currentFilter === project ? 'active' : ''}`}
            onClick={() => onFilterChange(project)}
          >
            {project}
          </div>
        ))}
      </div>

      {/* Filtri per tipo */}
      <div className="sidebar-section">
        <div className="sidebar-title">Type Filters</div>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <label key={type} className="filter-checkbox">
            <input
              type="checkbox"
              checked={activeTypes.has(type)}
              onChange={() => onToggleType(type)}
            />
            <span className="filter-dot" style={{ background: color }} />
            {type}
          </label>
        ))}
      </div>

      {/* Statistiche */}
      <div className="sidebar-section">
        <div className="sidebar-title">Stats</div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.observations}</div>
            <div className="stat-label">Observations</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.summaries}</div>
            <div className="stat-label">Summaries</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.prompts}</div>
            <div className="stat-label">Prompts</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{projects.length}</div>
            <div className="stat-label">Projects</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
