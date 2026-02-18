/**
 * ContextKit - Memoria e contesto persistente per Kiro CLI
 *
 * @packageDocumentation
 */

// Export SDK
export { ContextKitSDK, createContextKit } from './sdk/index.js';
export type { ContextKitConfig } from './sdk/index.js';

// Export database
export {
  ContextKitDatabase,
  DatabaseManager,
  getDatabase,
  initializeDatabase
} from './services/sqlite/index.js';

// Export ricerca avanzata
export {
  searchObservationsFTS,
  searchObservationsLIKE,
  searchSummariesFiltered,
  getObservationsByIds,
  getTimeline,
  getProjectStats
} from './services/sqlite/Search.js';

// Export tipi
export type {
  Observation,
  Summary,
  UserPrompt,
  DBSession,
  ContextContext,
  KiroMessage,
  KiroSession,
  KiroHookInput,
  SearchFilters,
  SearchResult,
  TimelineEntry
} from './types/worker-types.js';

// Export utility condivise hook
export { readStdin, detectProject, formatContext, runHook } from './hooks/utils.js';

// Export utilities
export { logger, LogLevel } from './utils/logger.js';
export type { Component } from './utils/logger.js';

// Versione
export const VERSION = '1.0.0';
