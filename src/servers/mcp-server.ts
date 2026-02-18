#!/usr/bin/env node
/**
 * ContextKit MCP Server per Kiro CLI
 *
 * Server MCP (Model Context Protocol) che espone tool di ricerca memoria.
 * Proxy leggero: delega tutte le operazioni al Worker HTTP (porta 3001).
 *
 * Uso: registrare in ~/.kiro/settings/mcp.json o nella config dell'agente.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

// Redirige console.log a stderr per non rompere il protocollo MCP (usa stdio)
const originalLog = console.log;
console.log = (...args: any[]) => console.error('[contextkit-mcp]', ...args);

const WORKER_HOST = process.env.CONTEXTKIT_WORKER_HOST || '127.0.0.1';
const WORKER_PORT = process.env.CONTEXTKIT_WORKER_PORT || '3001';
const WORKER_BASE = `http://${WORKER_HOST}:${WORKER_PORT}`;

// ============================================================================
// Helper HTTP per comunicare col Worker
// ============================================================================

async function callWorkerGET(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(endpoint, WORKER_BASE);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });

  const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error(`Worker ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

async function callWorkerPOST(endpoint: string, body: any): Promise<any> {
  const url = new URL(endpoint, WORKER_BASE);
  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  if (!resp.ok) throw new Error(`Worker ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

// ============================================================================
// Definizione Tool MCP
// ============================================================================

const TOOLS = [
  {
    name: 'search',
    description: 'Cerca nella memoria di ContextKit. Restituisce osservazioni e sommari che corrispondono alla query. Usa questo tool per trovare contesto da sessioni precedenti.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Testo da cercare nelle osservazioni e sommari' },
        project: { type: 'string', description: 'Filtra per nome progetto (opzionale)' },
        type: { type: 'string', description: 'Filtra per tipo osservazione: file-write, command, research, tool-use (opzionale)' },
        limit: { type: 'number', description: 'Numero massimo risultati (default: 20)' }
      },
      required: ['query']
    }
  },
  {
    name: 'timeline',
    description: 'Mostra il contesto cronologico attorno a un\'osservazione specifica. Utile per capire cosa è successo prima e dopo un evento.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        anchor: { type: 'number', description: 'ID dell\'osservazione come punto di riferimento' },
        depth_before: { type: 'number', description: 'Numero di osservazioni prima (default: 5)' },
        depth_after: { type: 'number', description: 'Numero di osservazioni dopo (default: 5)' }
      },
      required: ['anchor']
    }
  },
  {
    name: 'get_observations',
    description: 'Recupera i dettagli completi di osservazioni specifiche per ID. Usa dopo "search" per ottenere il contenuto completo.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array di ID osservazioni da recuperare'
        }
      },
      required: ['ids']
    }
  },
  {
    name: 'get_context',
    description: 'Recupera il contesto recente per un progetto: osservazioni, sommari e prompt recenti.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project: { type: 'string', description: 'Nome del progetto' }
      },
      required: ['project']
    }
  }
];

// ============================================================================
// Handler dei Tool
// ============================================================================

type ToolHandler = (args: any) => Promise<string>;

const handlers: Record<string, ToolHandler> = {
  async search(args: { query: string; project?: string; type?: string; limit?: number }) {
    const result = await callWorkerGET('/api/search', {
      q: args.query,
      project: args.project || '',
      type: args.type || '',
      limit: String(args.limit || 20)
    });

    const obs = result.observations || [];
    const sums = result.summaries || [];

    if (obs.length === 0 && sums.length === 0) {
      return 'Nessun risultato trovato per la query.';
    }

    let output = `## Risultati ricerca: "${args.query}"\n\n`;

    if (obs.length > 0) {
      output += `### Osservazioni (${obs.length})\n\n`;
      output += '| ID | Tipo | Titolo | Data |\n|---|---|---|---|\n';
      obs.forEach((o: any) => {
        output += `| ${o.id} | ${o.type} | ${o.title} | ${o.created_at?.split('T')[0] || ''} |\n`;
      });
      output += '\n';
    }

    if (sums.length > 0) {
      output += `### Sommari (${sums.length})\n\n`;
      sums.forEach((s: any) => {
        if (s.learned) output += `- **Appreso**: ${s.learned}\n`;
        if (s.completed) output += `- **Completato**: ${s.completed}\n`;
      });
    }

    return output;
  },

  async timeline(args: { anchor: number; depth_before?: number; depth_after?: number }) {
    const result = await callWorkerGET('/api/timeline', {
      anchor: String(args.anchor),
      depth_before: String(args.depth_before || 5),
      depth_after: String(args.depth_after || 5)
    });

    const entries = result.timeline || result || [];
    if (!Array.isArray(entries) || entries.length === 0) {
      return `Nessun contesto trovato attorno all'osservazione ${args.anchor}.`;
    }

    let output = `## Timeline attorno all'osservazione #${args.anchor}\n\n`;
    entries.forEach((e: any) => {
      const marker = e.id === args.anchor ? '→ ' : '  ';
      output += `${marker}**#${e.id}** [${e.type}] ${e.title} (${e.created_at?.split('T')[0] || ''})\n`;
      if (e.content) output += `  ${e.content.substring(0, 200)}\n`;
      output += '\n';
    });

    return output;
  },

  async get_observations(args: { ids: number[] }) {
    const result = await callWorkerPOST('/api/observations/batch', { ids: args.ids });
    const obs = result.observations || result || [];

    if (!Array.isArray(obs) || obs.length === 0) {
      return 'Nessuna osservazione trovata per gli ID specificati.';
    }

    let output = `## Dettagli Osservazioni\n\n`;
    obs.forEach((o: any) => {
      output += `### #${o.id}: ${o.title}\n`;
      output += `- **Tipo**: ${o.type}\n`;
      output += `- **Progetto**: ${o.project}\n`;
      output += `- **Data**: ${o.created_at}\n`;
      if (o.text) output += `- **Contenuto**: ${o.text}\n`;
      if (o.narrative) output += `- **Narrativa**: ${o.narrative}\n`;
      if (o.concepts) output += `- **Concetti**: ${o.concepts}\n`;
      if (o.files_read) output += `- **File letti**: ${o.files_read}\n`;
      if (o.files_modified) output += `- **File modificati**: ${o.files_modified}\n`;
      output += '\n';
    });

    return output;
  },

  async get_context(args: { project: string }) {
    const result = await callWorkerGET(`/api/context/${encodeURIComponent(args.project)}`);

    const obs = result.observations || [];
    const sums = result.summaries || [];

    let output = `## Contesto: ${args.project}\n\n`;

    if (sums.length > 0) {
      output += `### Sommari Recenti\n\n`;
      sums.forEach((s: any) => {
        if (s.request) output += `**Richiesta**: ${s.request}\n`;
        if (s.learned) output += `- Appreso: ${s.learned}\n`;
        if (s.completed) output += `- Completato: ${s.completed}\n`;
        if (s.next_steps) output += `- Prossimi passi: ${s.next_steps}\n\n`;
      });
    }

    if (obs.length > 0) {
      output += `### Osservazioni Recenti (${obs.length})\n\n`;
      obs.slice(0, 10).forEach((o: any) => {
        output += `- **${o.title}** [${o.type}]: ${(o.text || '').substring(0, 100)}\n`;
      });
    }

    return output;
  }
};

// ============================================================================
// Setup Server MCP
// ============================================================================

async function main() {
  const server = new Server(
    { name: 'contextkit', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // Lista tool disponibili
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS
  }));

  // Esecuzione tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = handlers[name];

    if (!handler) {
      return {
        content: [{ type: 'text', text: `Tool sconosciuto: ${name}` }],
        isError: true
      };
    }

    try {
      const result = await handler(args || {});
      return {
        content: [{ type: 'text', text: result }]
      };
    } catch (error: any) {
      const msg = error?.message || String(error);

      // Se il Worker non è raggiungibile, suggerisci come avviarlo
      if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
        return {
          content: [{
            type: 'text',
            text: `Worker ContextKit non raggiungibile su ${WORKER_BASE}.\nAvvia il worker con: cd <contextkit-dir> && npm run worker:start`
          }],
          isError: true
        };
      }

      return {
        content: [{ type: 'text', text: `Errore: ${msg}` }],
        isError: true
      };
    }
  });

  // Avvio su stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('ContextKit MCP server avviato su stdio');
}

main().catch((err) => {
  console.error('Errore avvio MCP server:', err);
  process.exit(1);
});
