#!/usr/bin/env node
/**
 * Hook agentSpawn per Kiro CLI
 *
 * Trigger: quando l'agente si attiva
 * Funzione: recupera contesto recente e lo inietta su stdout
 */

import { runHook, detectProject, formatContext } from './utils.js';
import { createContextKit } from '../sdk/index.js';

runHook('agentSpawn', async (input) => {
  const project = detectProject(input.cwd);
  const sdk = createContextKit({ project });

  try {
    const ctx = await sdk.getContext();

    // Se non c'e' contesto, esci silenziosamente
    if (ctx.relevantObservations.length === 0 && ctx.relevantSummaries.length === 0) {
      return;
    }

    let output = '# ContextKit: Contesto Sessioni Precedenti\n\n';
    output += formatContext({
      observations: ctx.relevantObservations,
      summaries: ctx.relevantSummaries,
      prompts: ctx.recentPrompts
    });

    output += `\n> Progetto: ${project} | Osservazioni: ${ctx.relevantObservations.length} | Sommari: ${ctx.relevantSummaries.length}\n`;

    // Stdout viene iniettato nel contesto dell'agente Kiro
    process.stdout.write(output);
  } finally {
    sdk.close();
  }
});
