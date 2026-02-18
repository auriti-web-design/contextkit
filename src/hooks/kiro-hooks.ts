/**
 * Hook system for Kiro CLI integration
 * 
 * Kiro uses a different hook format than Claude.
 * Hooks are triggered on file saves, completions, and other events.
 */

import { createContextKit } from '../sdk/index.js';
import { logger } from '../utils/logger.js';
import { getCurrentProjectName } from '../shared/paths.js';

export interface KiroHookContext {
  event: 'file-save' | 'session-start' | 'session-end' | 'prompt';
  project: string;
  data?: any;
}

export interface ContextKitHook {
  name: string;
  description: string;
  trigger: string;
  action: (context: KiroHookContext) => Promise<void>;
}

/**
 * Auto-context hook - injects relevant context on session start
 */
export const autoContextHook: ContextKitHook = {
  name: 'contextkit-auto-context',
  description: 'Automatically inject relevant context at session start',
  trigger: 'session-start',
  async action(context) {
    const contextkit = createContextKit({ project: context.project });
    
    try {
      const ctx = await contextkit.getContext();
      
      // Generate context summary for Kiro
      let contextText = `# ContextKit: Previous Context\n\n`;
      
      if (ctx.relevantSummaries.length > 0) {
        contextText += `## Recent Learnings\n\n`;
        ctx.relevantSummaries.slice(0, 3).forEach(sum => {
          if (sum.learned) contextText += `- ${sum.learned}\n`;
          if (sum.completed) contextText += `- Completed: ${sum.completed}\n`;
        });
        contextText += '\n';
      }
      
      if (ctx.relevantObservations.length > 0) {
        contextText += `## Recent Observations\n\n`;
        ctx.relevantObservations.slice(0, 5).forEach(obs => {
          contextText += `- **${obs.title}**: ${obs.text?.substring(0, 100) || 'No content'}...\n`;
        });
      }
      
      logger.info('HOOK', `Auto-context injected for project: ${context.project}`);
      
      // Return context to be injected into Kiro
      console.log(contextText);
    } finally {
      contextkit.close();
    }
  }
};

/**
 * File change tracker hook - tracks file modifications
 */
export const fileChangeHook: ContextKitHook = {
  name: 'contextkit-file-tracker',
  description: 'Track file changes during development',
  trigger: 'file-save',
  async action(context) {
    if (!context.data?.filePath) return;
    
    const contextkit = createContextKit({ project: context.project });
    
    try {
      await contextkit.storeObservation({
        type: 'file-change',
        title: `Modified: ${context.data.filePath}`,
        content: `File was modified at ${new Date().toISOString()}`,
        files: [context.data.filePath]
      });
      
      logger.debug('HOOK', `File change tracked: ${context.data.filePath}`);
    } finally {
      contextkit.close();
    }
  }
};

/**
 * Session summary hook - stores summary at session end
 */
export const sessionSummaryHook: ContextKitHook = {
  name: 'contextkit-session-summary',
  description: 'Store session summary when session ends',
  trigger: 'session-end',
  async action(context) {
    if (!context.data?.summary) return;
    
    const contextkit = createContextKit({ project: context.project });
    
    try {
      await contextkit.storeSummary({
        learned: context.data.summary
      });
      
      logger.info('HOOK', `Session summary stored for project: ${context.project}`);
    } finally {
      contextkit.close();
    }
  }
};

// Export all hooks
export const hooks: ContextKitHook[] = [
  autoContextHook,
  fileChangeHook,
  sessionSummaryHook
];

/**
 * Execute a hook by name
 */
export async function executeHook(
  hookName: string, 
  context: KiroHookContext
): Promise<void> {
  const hook = hooks.find(h => h.name === hookName);
  
  if (!hook) {
    logger.warn('HOOK', `Hook not found: ${hookName}`);
    return;
  }
  
  logger.info('HOOK', `Executing hook: ${hookName}`, { project: context.project });
  
  try {
    await hook.action(context);
    logger.success('HOOK', `Hook executed successfully: ${hookName}`);
  } catch (error) {
    logger.error('HOOK', `Hook execution failed: ${hookName}`, {}, error as Error);
    throw error;
  }
}
