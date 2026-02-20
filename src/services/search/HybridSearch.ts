/**
 * Ricerca ibrida: combina vector search locale (SQLite BLOB) con keyword search (FTS5)
 *
 * Se il servizio di embedding è disponibile, esegue ricerca semantica + keyword
 * e fonde i risultati con scoring ibrido. Altrimenti, fallback a solo FTS5.
 */

import { getEmbeddingService } from './EmbeddingService.js';
import { getVectorSearch } from './VectorSearch.js';
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
  source: 'vector' | 'keyword' | 'hybrid';
}

export class HybridSearch {
  private embeddingInitialized = false;

  /**
   * Inizializza il servizio di embedding (lazy, non bloccante)
   */
  async initialize(): Promise<void> {
    try {
      const embeddingService = getEmbeddingService();
      await embeddingService.initialize();
      this.embeddingInitialized = embeddingService.isAvailable();
      logger.info('SEARCH', `HybridSearch inizializzato (embedding: ${this.embeddingInitialized ? 'attivo' : 'disattivato'})`);
    } catch (error) {
      logger.warn('SEARCH', 'Inizializzazione embedding fallita, uso solo FTS5', {}, error as Error);
      this.embeddingInitialized = false;
    }
  }

  /**
   * Ricerca ibrida: vector + keyword
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

    // Ricerca vettoriale (se embedding disponibile)
    if (this.embeddingInitialized) {
      try {
        const embeddingService = getEmbeddingService();
        const queryEmbedding = await embeddingService.embed(query);

        if (queryEmbedding) {
          const vectorSearch = getVectorSearch();
          const vectorResults = await vectorSearch.search(db, queryEmbedding, {
            project: options.project,
            limit: Math.ceil(limit / 2),
            threshold: 0.3
          });

          for (const hit of vectorResults) {
            results.push({
              id: String(hit.observationId),
              title: hit.title,
              content: hit.text || '',
              type: hit.type,
              project: hit.project,
              created_at: hit.created_at,
              score: hit.similarity, // Cosine similarity 0-1
              source: 'vector'
            });
          }

          logger.debug('SEARCH', `Vector search: ${vectorResults.length} risultati`);
        }
      } catch (error) {
        logger.warn('SEARCH', 'Ricerca vettoriale fallita, uso solo keyword', {}, error as Error);
      }
    }

    // Ricerca keyword FTS5 (sempre attiva)
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
          score: 0.5, // Score di default per keyword match
          source: 'keyword'
        });
      }

      logger.debug('SEARCH', `Keyword search: ${keywordResults.length} risultati`);
    } catch (error) {
      logger.error('SEARCH', 'Ricerca keyword fallita', {}, error as Error);
    }

    // Deduplicazione e ordinamento per score
    return this.deduplicateAndSort(results, limit);
  }

  /**
   * Rimuovi duplicati e ordina per score decrescente
   */
  private deduplicateAndSort(results: SearchResult[], limit: number): SearchResult[] {
    const seen = new Map<string, SearchResult>();

    for (const result of results) {
      const existing = seen.get(result.id);
      if (!existing) {
        seen.set(result.id, result);
      } else if (result.score > existing.score) {
        // Se presente in entrambe le sorgenti, prendi lo score migliore
        seen.set(result.id, {
          ...result,
          source: 'hybrid',
          // Scoring ibrido: boost per risultati presenti in entrambe le sorgenti
          score: Math.min(1, result.score * 1.2)
        });
      }
    }

    const unique = Array.from(seen.values());
    unique.sort((a, b) => b.score - a.score);

    return unique.slice(0, limit);
  }
}

// Singleton
let hybridSearch: HybridSearch | null = null;

export function getHybridSearch(): HybridSearch {
  if (!hybridSearch) {
    hybridSearch = new HybridSearch();
  }
  return hybridSearch;
}
