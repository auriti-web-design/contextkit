/**
 * Hybrid search combining ChromaDB (vector) and SQLite (keyword)
 */

import { ChromaManager } from './ChromaManager.js';
import type { Database } from 'bun:sqlite';
import { logger } from '../../utils/logger.js';

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  type: string;
  project: string;
  created_at: string;
  score: number;
  source: 'vector' | 'keyword';
}

export class HybridSearch {
  private chromaManager: ChromaManager;

  constructor() {
    this.chromaManager = new ChromaManager();
  }

  /**
   * Initialize search (connects to ChromaDB if available)
   */
  async initialize(): Promise<void> {
    await this.chromaManager.initialize();
  }

  /**
   * Perform hybrid search combining vector and keyword results
   */
  async search(
    db: Database,
    query: string,
    options: {
      project?: string;
      limit?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const limit = options.limit || 10;
    const results: SearchResult[] = [];

    // Get vector search results if ChromaDB is available
    if (this.chromaManager.isChromaAvailable()) {
      try {
        const vectorResults = await this.chromaManager.search(query, {
          project: options.project,
          limit: Math.ceil(limit / 2)
        });

        for (const hit of vectorResults) {
          results.push({
            id: hit.id,
            title: hit.metadata.title || 'Untitled',
            content: hit.content,
            type: hit.metadata.type || 'unknown',
            project: hit.metadata.project || 'unknown',
            created_at: hit.metadata.created_at || new Date().toISOString(),
            score: 1 - hit.distance, // Convert distance to similarity score
            source: 'vector'
          });
        }

        logger.debug('SEARCH', `Vector search returned ${vectorResults.length} results`);
      } catch (error) {
        logger.warn('SEARCH', 'Vector search failed, using keyword only', {}, error as Error);
      }
    }

    // Get keyword search results from SQLite
    try {
      const { searchObservations } = await import('../sqlite/Observations.js');
      const keywordResults = searchObservations(db, query, options.project);

      for (const obs of keywordResults.slice(0, Math.ceil(limit / 2))) {
        results.push({
          id: String(obs.id),
          title: obs.title,
          content: obs.text || obs.narrative || '',
          type: obs.type,
          project: obs.project,
          created_at: obs.created_at,
          score: 0.5, // Default score for keyword matches
          source: 'keyword'
        });
      }

      logger.debug('SEARCH', `Keyword search returned ${keywordResults.length} results`);
    } catch (error) {
      logger.error('SEARCH', 'Keyword search failed', {}, error as Error);
    }

    // Sort by score and remove duplicates
    const uniqueResults = this.deduplicateAndSort(results, limit);
    
    return uniqueResults;
  }

  /**
   * Remove duplicates and sort by score
   */
  private deduplicateAndSort(results: SearchResult[], limit: number): SearchResult[] {
    const seen = new Set<string>();
    const unique: SearchResult[] = [];

    for (const result of results) {
      if (!seen.has(result.id)) {
        seen.add(result.id);
        unique.push(result);
      }
    }

    // Sort by score descending
    unique.sort((a, b) => b.score - a.score);

    return unique.slice(0, limit);
  }
}

// Singleton instance
let hybridSearch: HybridSearch | null = null;

export function getHybridSearch(): HybridSearch {
  if (!hybridSearch) {
    hybridSearch = new HybridSearch();
  }
  return hybridSearch;
}
