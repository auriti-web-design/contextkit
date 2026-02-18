/**
 * ContextKit Hook Definitions for Kiro CLI
 * 
 * This file defines hooks in Kiro-compatible format
 */

export const kiroHookDefinitions = {
  version: '1.0.0',
  hooks: [
    {
      name: 'contextkit-auto-context',
      description: 'Automatically inject relevant context at session start',
      trigger: {
        type: 'session-start',
        project: true
      },
      action: {
        type: 'inject-context',
        source: 'contextkit'
      }
    },
    {
      name: 'contextkit-file-tracker',
      description: 'Track file changes during development',
      trigger: {
        type: 'file-save',
        project: true
      },
      action: {
        type: 'store-observation',
        source: 'contextkit'
      }
    },
    {
      name: 'contextkit-session-summary',
      description: 'Store session summary when session ends',
      trigger: {
        type: 'session-end',
        project: true
      },
      action: {
        type: 'store-summary',
        source: 'contextkit'
      }
    }
  ]
};

export default kiroHookDefinitions;
