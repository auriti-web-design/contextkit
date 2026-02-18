/**
 * ContextKit SDK for Kiro CLI Integration
 * 
 * Provides programmatic access to ContextKit memory system
 */

import { ContextKitDatabase } from '../services/sqlite/index.js';
import type {
  Observation,
  Summary,
  UserPrompt,
  DBSession,
  ContextContext,
  SearchFilters,
  TimelineEntry
} from '../types/worker-types.js';

export interface ContextKitConfig {
  dataDir?: string;
  project?: string;
}

export class ContextKitSDK {
  private db: ContextKitDatabase;
  private project: string;

  constructor(config: ContextKitConfig = {}) {
    this.db = new ContextKitDatabase(config.dataDir);
    this.project = config.project || this.detectProject();
  }

  private detectProject(): string {
    try {
      const { execSync } = require('child_process');
      const gitRoot = execSync('git rev-parse --show-toplevel', {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      return gitRoot.split('/').pop() || 'default';
    } catch {
      return 'default';
    }
  }

  /**
   * Get context for the current project
   */
  async getContext(): Promise<ContextContext> {
    const { getObservationsByProject } = await import('../services/sqlite/Observations.js');
    const { getSummariesByProject } = await import('../services/sqlite/Summaries.js');
    const { getPromptsByProject } = await import('../services/sqlite/Prompts.js');

    return {
      project: this.project,
      relevantObservations: getObservationsByProject(this.db.db, this.project, 20),
      relevantSummaries: getSummariesByProject(this.db.db, this.project, 5),
      recentPrompts: getPromptsByProject(this.db.db, this.project, 10)
    };
  }

  /**
   * Store a new observation
   */
  async storeObservation(data: {
    type: string;
    title: string;
    content: string;
    concepts?: string[];
    files?: string[];
  }): Promise<number> {
    const { createObservation } = await import('../services/sqlite/Observations.js');
    
    return createObservation(
      this.db.db,
      'sdk-' + Date.now(),
      this.project,
      data.type,
      data.title,
      null,           // subtitle
      data.content,
      null,           // narrative
      null,           // facts
      data.concepts?.join(', ') || null,
      data.files?.join(', ') || null,  // files_read
      data.files?.join(', ') || null,  // files_modified
      0               // prompt_number
    );
  }

  /**
   * Store a session summary
   */
  async storeSummary(data: {
    request?: string;
    learned?: string;
    completed?: string;
    nextSteps?: string;
  }): Promise<number> {
    const { createSummary } = await import('../services/sqlite/Summaries.js');
    
    return createSummary(
      this.db.db,
      'sdk-' + Date.now(),
      this.project,
      data.request || null,
      null,
      data.learned || null,
      data.completed || null,
      data.nextSteps || null,
      null
    );
  }

  /**
   * Search across all stored context
   */
  async search(query: string): Promise<{
    observations: Observation[];
    summaries: Summary[];
  }> {
    const { searchObservations } = await import('../services/sqlite/Observations.js');
    const { searchSummaries } = await import('../services/sqlite/Summaries.js');

    return {
      observations: searchObservations(this.db.db, query, this.project),
      summaries: searchSummaries(this.db.db, query, this.project)
    };
  }

  /**
   * Get recent observations
   */
  async getRecentObservations(limit: number = 10): Promise<Observation[]> {
    const { getObservationsByProject } = await import('../services/sqlite/Observations.js');
    return getObservationsByProject(this.db.db, this.project, limit);
  }

  /**
   * Get recent summaries
   */
  async getRecentSummaries(limit: number = 5): Promise<Summary[]> {
    const { getSummariesByProject } = await import('../services/sqlite/Summaries.js');
    return getSummariesByProject(this.db.db, this.project, limit);
  }

  /**
   * Ricerca avanzata con FTS5 e filtri
   */
  async searchAdvanced(query: string, filters: SearchFilters = {}): Promise<{
    observations: Observation[];
    summaries: Summary[];
  }> {
    const { searchObservationsFTS } = await import('../services/sqlite/Search.js');
    const { searchSummariesFiltered } = await import('../services/sqlite/Search.js');

    const projectFilters = { ...filters, project: filters.project || this.project };

    return {
      observations: searchObservationsFTS(this.db.db, query, projectFilters),
      summaries: searchSummariesFiltered(this.db.db, query, projectFilters)
    };
  }

  /**
   * Recupera osservazioni per ID (batch)
   */
  async getObservationsByIds(ids: number[]): Promise<Observation[]> {
    const { getObservationsByIds } = await import('../services/sqlite/Search.js');
    return getObservationsByIds(this.db.db, ids);
  }

  /**
   * Timeline: contesto cronologico attorno a un'osservazione
   */
  async getTimeline(anchorId: number, depthBefore: number = 5, depthAfter: number = 5): Promise<TimelineEntry[]> {
    const { getTimeline } = await import('../services/sqlite/Search.js');
    return getTimeline(this.db.db, anchorId, depthBefore, depthAfter);
  }

  /**
   * Crea o recupera una sessione per il progetto corrente
   */
  async getOrCreateSession(contentSessionId: string): Promise<DBSession> {
    const { getSessionByContentId, createSession } = await import('../services/sqlite/Sessions.js');

    let session = getSessionByContentId(this.db.db, contentSessionId);
    if (!session) {
      const id = createSession(this.db.db, contentSessionId, this.project, '');
      session = {
        id, content_session_id: contentSessionId, project: this.project,
        user_prompt: '', memory_session_id: null, status: 'active',
        started_at: new Date().toISOString(), started_at_epoch: Date.now(),
        completed_at: null, completed_at_epoch: null
      };
    }
    return session;
  }

  /**
   * Salva un prompt utente
   */
  async storePrompt(contentSessionId: string, promptNumber: number, text: string): Promise<number> {
    const { createPrompt } = await import('../services/sqlite/Prompts.js');
    return createPrompt(this.db.db, contentSessionId, this.project, promptNumber, text);
  }

  /**
   * Completa una sessione
   */
  async completeSession(sessionId: number): Promise<void> {
    const { completeSession } = await import('../services/sqlite/Sessions.js');
    completeSession(this.db.db, sessionId);
  }

  /**
   * Getter per il nome progetto corrente
   */
  getProject(): string {
    return this.project;
  }

  /**
   * Getter per accesso diretto al database (per route API)
   */
  getDb(): any {
    return this.db.db;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Export convenience function
export function createContextKit(config?: ContextKitConfig): ContextKitSDK {
  return new ContextKitSDK(config);
}

// Re-export types
export type {
  Observation,
  Summary,
  UserPrompt,
  DBSession,
  ContextContext,
  SearchFilters,
  TimelineEntry
} from '../types/worker-types.js';
