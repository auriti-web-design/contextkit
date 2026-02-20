# Kiro Memory — Feature Roadmap & Strategic Report

> Basato su ricerca di mercato, analisi competitor, pain point utenti e trend 2025-2026.
> Ultimo aggiornamento: Febbraio 2026

---

## Executive Summary

Il mercato dei tool di memoria/contesto per AI coding è in esplosione:
- **$7.37B** il mercato AI code tools (2025), proiezione **$24B** entro 2030
- **84%** degli sviluppatori usa tool AI, ma solo **33%** si fida dell'output
- **Pain point #1 universale**: l'AI dimentica tutto tra una sessione e l'altra
- **219+ MCP memory server** su PulseMCP — domanda altissima, frammentazione estrema
- **Nessun tool risolve il problema completo**: ogni soluzione copre un sottoinsieme

**Posizionamento Kiro Memory**: l'unico tool open source, local-first, che unisce auto-capture + ricerca FTS5 + dashboard web + SDK + MCP server, focalizzato specificamente sul coding workflow.

---

## Analisi Competitiva — Dove Siamo

| Feature | Kiro Memory | OMEGA | Mem0/OpenMemory | Cursor Memories | Claude Auto Memory |
|---------|:-----------:|:-----:|:---------------:|:---------------:|:-----------------:|
| Local-first | ✅ | ✅ | Parziale | ✅ | ✅ |
| Auto-capture (hooks) | ✅ | ✅ | ❌ | ✅ | ✅ |
| FTS5 search | ✅ | ✅ | ❌ (vector) | ❌ | ❌ |
| Dashboard web | ✅ | ❌ | ✅ | ❌ | ❌ |
| MCP server | ✅ | ✅ | ✅ | ❌ | ❌ |
| SDK programmatico | ✅ | ❌ | ✅ | ❌ | ❌ |
| CLI | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cross-editor | ❌ (solo Kiro) | Cursor/Windsurf/Zed | Multi-tool via MCP | Solo Cursor | Solo Claude Code |
| Semantic search (embeddings) | ❌ | ✅ | ✅ | ❌ | ❌ |
| Team sharing | ❌ | ❌ | Cloud option | ❌ | ❌ |
| Analytics/metriche | ❌ | ❌ | ❌ | ❌ | ❌ |
| Decision tracking | ❌ | ❌ | ❌ | ❌ | ❌ |
| Open source | ✅ AGPL-3.0 | ✅ | SDK yes, cloud no | ❌ | ❌ |

### I nostri vantaggi competitivi attuali
1. **Unico con dashboard web + SDK + CLI + MCP** in un singolo pacchetto
2. **Open source genuino** (AGPL-3.0) vs competitor cloud-dependent
3. **Auto-capture via hooks** senza intervento manuale
4. **FTS5** per ricerca veloce e typo-tolerant
5. **Architettura modulare**: hook → worker → SQLite → MCP/SDK/CLI/Web

### I nostri gap rispetto al mercato
1. **Solo Kiro CLI** — esclude l'85%+ degli sviluppatori
2. **Nessuna ricerca semantica** — non trova risultati per concetti simili
3. **Nessun team sharing** — la memoria resta locale
4. **Nessuna analytics** — non misura impatto produttività
5. **Nessun tracking decisioni** — non cattura il "perché"

---

## Feature Roadmap

### FASE 1 — Cross-Editor (Impatto: ALTISSIMO)

> **Obiettivo**: Rendere Kiro Memory utilizzabile da Claude Code, Cursor, Windsurf, Cline, VS Code
> **Motivazione**: L'85% degli sviluppatori usa tool diversi da Kiro CLI. Il 59% usa 3+ tool in parallelo.

#### 1A. Claude Code Adapter
- **Hook system**: Claude Code ha 15 hook events. Mappare:
  - `SessionStart` → inject context (equivalente del nostro `agentSpawn`)
  - `UserPromptSubmit` → track prompt
  - `PostToolUse` → capture file writes, commands
  - `Stop` → generate summary
- **Configurazione**: Generare `.claude/settings.json` con hooks + `.mcp.json` per MCP server
- **Installer**: `kiro-memory install --claude-code`
- **Note tecniche**: Gli hook Claude Code ricevono JSON su stdin (identico al nostro formato). L'iniezione contesto avviene via stdout nel `SessionStart`.

#### 1B. Cursor Adapter
- **Hook system**: Cursor ha 6 hook events (da v1.7). Mappare:
  - `beforeSubmitPrompt` → inject context
  - `afterFileEdit` → capture edits
  - `stop` → generate summary
- **Configurazione**: Generare `.cursor/hooks.json`
- **MCP**: Cursor supporta MCP nativamente → registrare il nostro MCP server
- **Installer**: `kiro-memory install --cursor`

#### 1C. Windsurf/Cline Adapter
- **Windsurf**: Non ha hooks nativi completi, ma supporta MCP → usare solo MCP server
- **Cline**: Supporta MCP + `.clinerules` → MCP server + rules file per context injection
- **Installers**: `kiro-memory install --windsurf`, `kiro-memory install --cline`

#### 1D. VS Code Extension (futuro)
- Extension che wrappa il MCP server + dashboard web in un pannello VS Code
- Auto-detect dell'editor/agent in uso (Claude Code, Cursor, Cline)

---

### FASE 2 — Smart Context & Semantic Search (Impatto: ALTO)

> **Obiettivo**: Iniettare contesto rilevante, non solo recente
> **Motivazione**: Il 54% degli sviluppatori dice che l'AI manca di rilevanza anche con context manuale. Il 65% cita missing context durante refactoring.

#### 2A. Embedding Locale + Vector Search
- **Modello**: `all-MiniLM-L6-v2` via ONNX Runtime (384 dimensioni, ~100MB)
- **Storage**: Tabella `observation_embeddings(id, embedding BLOB)` in SQLite
- **Pipeline**: Ogni osservazione → embedding generato in background dal worker
- **Query**: Cosine similarity tra query embedding e osservazioni
- **Fallback**: Se ONNX non disponibile, FTS5 come oggi
- **Impatto**: Trova "come ho risolto il bug di auth" anche se il testo dice "Fixed OAuth token refresh"

#### 2B. Ranking di Rilevanza per Context Injection
- **Algoritmo ibrido**: FTS5 score + cosine similarity + recency decay + project match
- **Formula**: `score = 0.4 * semantic + 0.3 * fts5 + 0.2 * recency + 0.1 * project_match`
- **Limite token**: Iniettare max N token di contesto (configurabile, default 2000)
- **Smart truncation**: Troncare osservazioni lunghe mantenendo le parti più rilevanti

#### 2C. Memory Decay & Contradiction Detection
- **Decay**: Score ridotto per osservazioni vecchie non referenziate (half-life configurabile)
- **Stale detection**: Se un file è stato modificato dopo un'osservazione che lo menziona, segnalare come potenzialmente stale
- **Consolidation**: Unire osservazioni simili in una singola entry più concisa

---

### FASE 3 — Team Memory (Impatto: ALTO)

> **Obiettivo**: La conoscenza non resta intrappolata in sessioni individuali
> **Motivazione**: Il knowledge sharing tra team è il 4° pain point più citato. Le aziende con onboarding AI riportano -53% tempo onboarding.

#### 3A. Git-Based Sync
- **Export**: `kiro-memory export --format=json > .kiro-memory/shared-context.json`
- **Import**: `kiro-memory import .kiro-memory/shared-context.json`
- **Auto-sync**: Opzione per aggiungere export al pre-commit hook
- **Filtri**: Esportare solo decisioni architetturali, convenzioni, pattern (non debug temporaneo)
- **Privacy**: Tag `private` per osservazioni che non devono essere condivise

#### 3B. Shared Memory Layer
- **Server condiviso**: Worker accessibile a tutti i dev del team (non solo localhost)
- **Auth**: Token per team, oppure integrazione con SSO esistente
- **Merge strategy**: Osservazioni da più dev vengono unite con deduplicazione
- **Namespace**: Ogni dev ha il proprio namespace + namespace team condiviso

#### 3C. Team Knowledge Base
- **Auto-extract conventions**: Analizzare le osservazioni del team per estrarre pattern comuni
- **Architecture Decision Records (ADR)**: Tipo speciale di osservazione per decisioni
- **Onboarding context**: `kiro-memory onboard` inietta le top-50 decisioni del progetto

---

### FASE 4 — Analytics & Productivity Dashboard (Impatto: MEDIO-ALTO)

> **Obiettivo**: Misurare l'impatto della memoria AI sulla produttività
> **Motivazione**: Il 95% delle aziende non vede ROI misurabile dall'AI. Nessun tool open source offre analytics.

#### 4A. Dashboard Metriche Base
- **Sessioni/giorno**, file modificati, tool usati, comandi eseguiti
- **Pattern di lavoro**: orari di picco, progetti più attivi, tipi di task
- **Memory utilization**: quante volte il contesto iniettato è stato effettivamente utile
- **Trend settimanale/mensile**

#### 4B. Report Automatici
- **Weekly digest**: Markdown/PDF con riepilogo attività
- **Formato**: "Questa settimana: 12 sessioni, 34 file modificati, 5 decisioni architetturali"
- **Export**: Markdown, JSON, PDF
- **Integrazione**: Webhook per Slack/Discord/Linear/Notion

#### 4C. Metriche Team (futuro)
- Distribuzione attività per dev
- Knowledge coverage: % del codebase con osservazioni
- Decisioni non documentate (file modificati senza osservazione associata)

---

### FASE 5 — Decision & Convention Tracking (Impatto: MEDIO-ALTO)

> **Obiettivo**: Catturare non solo cosa è successo, ma perché
> **Motivazione**: Il 52% dei senior developer cita la mancata comprensione del contesto decisionale. L'AI ripropone soluzioni già scartate.

#### 5A. Tipi di Memoria Strutturata
Basato sul modello proposto su Hacker News:
- **Constraints**: Regole hard (es. "mai usare any in TypeScript")
- **Decisions**: Scelte con motivazione (es. "scelto PostgreSQL per ACID compliance perché...")
- **Heuristics**: Preferenze soft (es. "preferire functional components")
- **Rejected**: Soluzioni esplicitamente scartate (es. "non usare MongoDB perché...")

#### 5B. Auto-Extract Decisions
- Quando l'utente scrive "ho scelto X perché Y" o "non usare Z", estrarre automaticamente
- Pattern detection su commit messages, PR descriptions, code comments
- Prompt l'utente per conferma se l'estrazione è ambigua

#### 5C. Convention Learning
- Analizzare il codice del progetto per dedurre convenzioni
- Es: "il 95% delle funzioni usa async/await" → convenzione auto-estratta
- Es: "tutti i test seguono il pattern test_{soggetto}_{scenario}" → convenzione
- Usare tree-sitter per parsing AST (come fa In Memoria)

---

### FASE 6 — Checkpoint & Resume (Impatto: MEDIO)

> **Obiettivo**: Riprendere un task esattamente dove si era fermato
> **Motivazione**: Solo OMEGA e Cline (new_task) risolvono questo. Claude Code era descritto come "un pesce rosso" dalla community.

#### 6A. Session Checkpoint
- **Snapshot**: Prima della compaction, salvare un riassunto strutturato del task in corso
- **Formato**: `{ task, progress, nextSteps, openQuestions, relevantFiles }`
- **Auto-trigger**: Quando il context window supera il 70% (soglia configurabile)

#### 6B. Resume Command
- `kiro-memory resume [session-id]` → inietta il checkpoint nel nuovo contesto
- MCP tool `resume_session` per uso programmatico
- Nella dashboard: click su sessione → "Resume" button

---

### FASE 7 — Cross-Tool Memory Portability (Impatto: MEDIO)

> **Obiettivo**: Memoria accessibile da qualsiasi tool
> **Motivazione**: Gli sviluppatori usano 3+ tool in parallelo. Nessuno standardizza il formato di memoria.

#### 7A. Universal Memory Format
- **Standard JSON schema** per osservazioni, decisioni, convenzioni
- **Import/Export** da: CLAUDE.md, .cursorrules, .clinerules, Memory Bank
- `kiro-memory import --from=claude-md CLAUDE.md`
- `kiro-memory export --to=cursorrules .cursorrules`

#### 7B. MCP Memory Hub
- Il nostro MCP server diventa hub centralizzato
- Qualsiasi tool MCP-compatible legge/scrive nella stessa knowledge base
- Cross-reference: "Questa decisione è stata presa nella sessione Cursor #42, poi confermata in Claude Code #18"

---

## Priorità di Implementazione

| Fase | Feature | Effort | Impatto Visibilità | Impatto Utenti | Priorità |
|------|---------|--------|-------------------|----------------|----------|
| 1A | Claude Code adapter | Medio | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **P0** |
| 1B | Cursor adapter | Medio | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **P0** |
| 2A | Vector search locale | Medio | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **P1** |
| 4A | Dashboard metriche | Medio | ⭐⭐⭐⭐ | ⭐⭐⭐ | **P1** |
| 2B | Smart ranking injection | Basso | ⭐⭐⭐ | ⭐⭐⭐⭐ | **P1** |
| 5A | Tipi memoria strutturata | Basso | ⭐⭐⭐ | ⭐⭐⭐⭐ | **P1** |
| 6A | Session checkpoint | Basso | ⭐⭐⭐ | ⭐⭐⭐⭐ | **P2** |
| 1C | Windsurf/Cline adapter | Basso | ⭐⭐⭐ | ⭐⭐⭐ | **P2** |
| 3A | Git-based sync | Medio | ⭐⭐⭐ | ⭐⭐⭐ | **P2** |
| 4B | Report automatici | Basso | ⭐⭐⭐⭐ | ⭐⭐ | **P2** |
| 5C | Convention learning | Alto | ⭐⭐⭐⭐ | ⭐⭐⭐ | **P3** |
| 3B | Shared memory layer | Alto | ⭐⭐⭐ | ⭐⭐⭐ | **P3** |
| 7A | Universal memory format | Medio | ⭐⭐⭐⭐ | ⭐⭐ | **P3** |
| 2C | Memory decay/contradiction | Medio | ⭐⭐ | ⭐⭐⭐ | **P3** |
| 1D | VS Code extension | Alto | ⭐⭐⭐ | ⭐⭐ | **P4** |
| 3C | Team knowledge base | Alto | ⭐⭐⭐ | ⭐⭐⭐ | **P4** |
| 4C | Metriche team | Medio | ⭐⭐ | ⭐⭐ | **P4** |

---

## Quick Wins per Visibilità Immediata

### 1. Articolo "How I solved AI's goldfish memory" su dev.to / Hacker News
- Il termine "goldfish" è già virale nella community
- Mostrare demo: sessione senza Kiro Memory vs con Kiro Memory
- Target: front page di HN (argomento è hot, 219+ MCP server in crescita)

### 2. Video demo su X/Twitter
- 60 secondi: "L'AI dimentica tutto? Non più."
- Mostrare dashboard web, auto-capture, context injection
- Tag: @kaboradev @addyosmani @simonw (influencer AI coding)

### 3. MCP Server Registry
- Pubblicare su [PulseMCP](https://www.pulsemcp.com/) e [mcp.so](https://mcp.so)
- Il nostro MCP server diventa scopribile da tutti gli utenti Claude Code/Cursor

### 4. GitHub Badges & Social Proof
- Aggiungere badge: npm downloads, GitHub stars, test coverage
- Creare AGENTS.md per compatibilità cross-tool
- Aggiungere al awesome-mcp-servers list

---

## Fonti Chiave della Ricerca

### Mercato & Trend
- Stack Overflow 2025 Survey: 84% adozione, 33% fiducia
- Mordor Intelligence: mercato $7.37B → $24B (CAGR 26.6%)
- CB Insights: mercato AI agents $7.84B → $52.62B (CAGR 46.3%)
- Anthropic 2026 Agentic Coding Trends Report

### Competitor
- OMEGA: #1 LongMemEval benchmark (95.4%), 25 MCP tools
- Mem0: $24M Series A, 41K GitHub stars, OpenMemory MCP
- Copilot Agentic Memory: citation-backed, auto-validation, 28-day expiry

### Pain Point Utenti
- Reddit r/ClaudeAI, r/cursor: "talking to a goldfish"
- GitHub anthropics/claude-code #11261: "200k tokens is very bad!"
- Martin Fowler: degradazione MECW a 1.000 token in pratica
- 65% sviluppatori: missing context durante refactoring
- 46% sviluppatori: diffidenza attiva verso output AI

### Tecnico
- Claude Code: 15 hook events, 3 handler types, context injection via stdout
- Cursor: 6 hook events, .cursor/hooks.json, MCP nativo
- MCP: standard Linux Foundation, adottato da OpenAI/Google/Microsoft/AWS
