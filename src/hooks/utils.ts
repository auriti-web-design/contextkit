/**
 * Utility condivise per gli hook Kiro CLI
 *
 * Contratto Kiro:
 * - Input: JSON via stdin con { hook_event_name, cwd, tool_name, tool_input, tool_response }
 * - Output: testo su stdout (iniettato nel contesto dell'agente)
 * - Exit code 0 = successo, 2 = blocco (stderr inviato all'LLM)
 */

import type { KiroHookInput } from '../types/worker-types.js';

/**
 * Legge e parsa JSON da stdin
 */
export async function readStdin(): Promise<KiroHookInput> {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        if (!data.trim()) {
          // Nessun input: crea un contesto minimo
          resolve({
            hook_event_name: 'agentSpawn',
            cwd: process.cwd()
          });
          return;
        }
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error(`Errore parsing stdin JSON: ${err}`));
      }
    });
    process.stdin.on('error', reject);

    // Timeout di sicurezza: 5 secondi
    setTimeout(() => {
      if (!data.trim()) {
        resolve({
          hook_event_name: 'agentSpawn',
          cwd: process.cwd()
        });
      }
    }, 5000);
  });
}

/**
 * Rileva il nome del progetto dalla cwd
 */
export function detectProject(cwd: string): string {
  try {
    const { execSync } = require('child_process');
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    return gitRoot.split('/').pop() || 'default';
  } catch {
    // Fallback: ultimo segmento del path
    return cwd.split('/').pop() || 'default';
  }
}

/**
 * Formatta il contesto per l'iniezione in Kiro
 */
export function formatContext(data: {
  observations?: Array<{ title: string; text?: string | null; type?: string; created_at?: string }>;
  summaries?: Array<{ learned?: string | null; completed?: string | null; next_steps?: string | null; created_at?: string }>;
  prompts?: Array<{ prompt_text: string; created_at?: string }>;
}): string {
  let output = '';

  if (data.summaries && data.summaries.length > 0) {
    output += '## Sessioni Precedenti\n\n';
    data.summaries.slice(0, 3).forEach(sum => {
      if (sum.learned) output += `- **Appreso**: ${sum.learned}\n`;
      if (sum.completed) output += `- **Completato**: ${sum.completed}\n`;
      if (sum.next_steps) output += `- **Prossimi passi**: ${sum.next_steps}\n`;
      output += '\n';
    });
  }

  if (data.observations && data.observations.length > 0) {
    output += '## Osservazioni Recenti\n\n';
    data.observations.slice(0, 10).forEach(obs => {
      const text = obs.text ? obs.text.substring(0, 150) : '';
      output += `- **[${obs.type || 'obs'}] ${obs.title}**: ${text}\n`;
    });
    output += '\n';
  }

  return output;
}

/**
 * Wrapper sicuro per eseguire un hook con gestione errori
 */
export async function runHook(
  name: string,
  handler: (input: KiroHookInput) => Promise<void>
): Promise<void> {
  try {
    const input = await readStdin();
    await handler(input);
    process.exit(0);
  } catch (error) {
    process.stderr.write(`[contextkit:${name}] Errore: ${error}\n`);
    process.exit(0); // Exit 0 per degradazione silenziosa (non bloccare Kiro)
  }
}
