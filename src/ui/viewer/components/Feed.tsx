import React from 'react';
import { Observation, Summary, UserPrompt } from '../types';
import { getBadgeClass, timeAgo } from '../utils/format';

interface FeedProps {
  observations: Observation[];
  summaries: Summary[];
  prompts: UserPrompt[];
  onLoadMore: () => void;
  isLoading: boolean;
  hasMore: boolean;
}

export function Feed({ observations, summaries, prompts, onLoadMore, isLoading, hasMore }: FeedProps) {
  // Unisce tutti i tipi e ordina per timestamp decrescente
  const items = [...observations, ...summaries, ...prompts].sort(
    (a, b) => b.created_at_epoch - a.created_at_epoch
  );

  return (
    <div className="feed">
      {items.map((item) => {
        if ('type' in item && 'title' in item) {
          return <ObservationCard key={`obs-${item.id}`} obs={item as Observation} />;
        } else if ('request' in item) {
          return <SummaryCard key={`sum-${item.id}`} summary={item as Summary} />;
        } else {
          return <PromptCard key={`prompt-${item.id}`} prompt={item as UserPrompt} />;
        }
      })}

      {hasMore && (
        <button
          className="load-more-btn"
          onClick={onLoadMore}
          disabled={isLoading}
        >
          {isLoading ? 'Caricamento...' : 'Carica altri'}
        </button>
      )}

      {items.length === 0 && !isLoading && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 6v6l4 2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <p>Nessun dato disponibile.</p>
          <p className="empty-state-hint">Avvia una sessione con Kiro per iniziare a raccogliere contesto.</p>
        </div>
      )}
    </div>
  );
}

/* ── Card Osservazione ── */
function ObservationCard({ obs }: { obs: Observation }) {
  // Tipo specifico per il bordo sinistro
  const cardClass = `card card--${obs.type.replace(/\s+/g, '-')}`;

  return (
    <div className={cardClass}>
      <div className="card-header">
        <span className={`badge ${getBadgeClass(obs.type)}`}>{obs.type}</span>
        <span className="card-project">{obs.project}</span>
        <span className="card-time">{timeAgo(obs.created_at_epoch)}</span>
      </div>

      <h3 className="card-title">{obs.title}</h3>

      {obs.subtitle && <p className="card-subtitle">{obs.subtitle}</p>}

      {obs.text && (
        <div className="card-content">
          <p>{obs.text}</p>
        </div>
      )}

      {obs.narrative && (
        <div className="card-section">
          <span className="card-section-label">Narrativa</span>
          <p>{obs.narrative}</p>
        </div>
      )}

      {obs.facts && (
        <div className="card-section">
          <span className="card-section-label">Fatti</span>
          <p>{obs.facts}</p>
        </div>
      )}

      {/* File modificati / letti */}
      {(obs.files_modified || obs.files_read) && (
        <div className="card-files">
          {obs.files_modified && (
            <span className="file-pill file-pill--modified" title="File modificati">
              ✎ {obs.files_modified.split(',').length} file
            </span>
          )}
          {obs.files_read && (
            <span className="file-pill file-pill--read" title="File letti">
              ◉ {obs.files_read.split(',').length} file
            </span>
          )}
        </div>
      )}

      {/* Concetti come pill tag */}
      {obs.concepts && (
        <div className="card-tags">
          {obs.concepts.split(', ').map((concept, i) => (
            <span key={i} className="tag">{concept}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Card Summary ── */
function SummaryCard({ summary }: { summary: Summary }) {
  return (
    <div className="card card--summary">
      <div className="card-header">
        <span className="badge badge--summary">summary</span>
        <span className="card-project">{summary.project}</span>
        <span className="card-time">{timeAgo(summary.created_at_epoch)}</span>
      </div>

      {summary.request && <h3 className="card-title">{summary.request}</h3>}

      {summary.investigated && (
        <div className="card-section">
          <span className="card-section-label">Indagato</span>
          <p>{summary.investigated}</p>
        </div>
      )}

      {summary.learned && (
        <div className="card-section">
          <span className="card-section-label">Appreso</span>
          <p>{summary.learned}</p>
        </div>
      )}

      {summary.completed && (
        <div className="card-section">
          <span className="card-section-label">Completato</span>
          <p>{summary.completed}</p>
        </div>
      )}

      {summary.next_steps && (
        <div className="card-section">
          <span className="card-section-label">Prossimi passi</span>
          <p>{summary.next_steps}</p>
        </div>
      )}

      {summary.notes && (
        <div className="card-section">
          <span className="card-section-label">Note</span>
          <p>{summary.notes}</p>
        </div>
      )}
    </div>
  );
}

/* ── Card Prompt ── */
function PromptCard({ prompt }: { prompt: UserPrompt }) {
  return (
    <div className="card card--prompt">
      <div className="card-header">
        <span className="badge badge--prompt">prompt #{prompt.prompt_number}</span>
        <span className="card-project">{prompt.project}</span>
        <span className="card-time">{timeAgo(prompt.created_at_epoch)}</span>
      </div>

      <div className="card-content card-content--mono">
        <p>{prompt.prompt_text}</p>
      </div>
    </div>
  );
}
