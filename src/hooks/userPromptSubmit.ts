#!/usr/bin/env node
/**
 * Hook userPromptSubmit per Kiro CLI
 *
 * Trigger: quando l'utente invia un prompt
 * Funzione: salva il prompt nel database per contesto futuro
 */

import { runHook, detectProject, notifyWorker } from './utils.js';
import { createContextKit } from '../sdk/index.js';

runHook('userPromptSubmit', async (input) => {
  const project = detectProject(input.cwd);
  const sdk = createContextKit({ project });

  try {
    // Estrai il testo del prompt dall'input del tool
    const promptText = input.tool_input?.prompt
      || input.tool_input?.content
      || input.tool_input?.message
      || JSON.stringify(input.tool_input || '').substring(0, 500);

    if (!promptText || promptText === '""') return;

    // Genera un session ID basato sulla data
    const sessionId = `kiro-${new Date().toISOString().split('T')[0]}-${project}`;

    await sdk.storePrompt(sessionId, Date.now(), promptText);

    // Notifica la dashboard in tempo reale
    await notifyWorker('prompt-created', { project });
  } finally {
    sdk.close();
  }
});
