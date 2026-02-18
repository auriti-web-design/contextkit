import React from 'react';
import { Observation, Summary, UserPrompt } from '../types';

interface FeedProps {
  observations: Observation[];
  summaries: Summary[];
  prompts: UserPrompt[];
  onLoadMore: () => void;
  isLoading: boolean;
  hasMore: boolean;
}

export function Feed({ observations, summaries, prompts, onLoadMore, isLoading, hasMore }: FeedProps) {
  // Combine and sort by timestamp
  const items = [...observations, ...summaries, ...prompts].sort(
    (a, b) => b.created_at_epoch - a.created_at_epoch
  );

  return (
    <div className="feed">
      {items.map((item) => {
        if ('type' in item) {
          return <ObservationCard key={`obs-${item.id}`} observation={item as Observation} />;
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
          {isLoading ? 'Loading...' : 'Load More'}
        </button>
      )}

      {items.length === 0 && !isLoading && (
        <div className="empty-state">
          <p>No data available. Start using ContextKit to see your context here.</p>
        </div>
      )}
    </div>
  );
}

function ObservationCard({ observation }: { observation: Observation }) {
  return (
    <div className="card observation-card">
      <div className="card-header">
        <span className="card-type">{observation.type}</span>
        <span className="card-project">{observation.project}</span>
        <span className="card-date">
          {new Date(observation.created_at).toLocaleString()}
        </span>
      </div>
      <h3 className="card-title">{observation.title}</h3>
      {observation.subtitle && <p className="card-subtitle">{observation.subtitle}</p>}
      {observation.text && <p className="card-content">{observation.text}</p>}
      {observation.concepts && (
        <div className="card-tags">
          {observation.concepts.split(', ').map((concept, i) => (
            <span key={i} className="tag">{concept}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ summary }: { summary: Summary }) {
  return (
    <div className="card summary-card">
      <div className="card-header">
        <span className="card-type">Summary</span>
        <span className="card-project">{summary.project}</span>
        <span className="card-date">
          {new Date(summary.created_at).toLocaleString()}
        </span>
      </div>
      {summary.request && <h3 className="card-title">{summary.request}</h3>}
      {summary.learned && (
        <div className="summary-section">
          <strong>Learned:</strong>
          <p>{summary.learned}</p>
        </div>
      )}
      {summary.completed && (
        <div className="summary-section">
          <strong>Completed:</strong>
          <p>{summary.completed}</p>
        </div>
      )}
      {summary.next_steps && (
        <div className="summary-section">
          <strong>Next Steps:</strong>
          <p>{summary.next_steps}</p>
        </div>
      )}
    </div>
  );
}

function PromptCard({ prompt }: { prompt: UserPrompt }) {
  return (
    <div className="card prompt-card">
      <div className="card-header">
        <span className="card-type">Prompt #{prompt.prompt_number}</span>
        <span className="card-project">{prompt.project}</span>
        <span className="card-date">
          {new Date(prompt.created_at).toLocaleString()}
        </span>
      </div>
      <p className="card-content">{prompt.prompt_text}</p>
    </div>
  );
}
