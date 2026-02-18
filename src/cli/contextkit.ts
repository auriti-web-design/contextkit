/**
 * Kiro Memory CLI - Interfaccia a riga di comando
 * (shebang aggiunto automaticamente dal build)
 */

import { createContextKit } from '../sdk/index.js';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir, platform, release } from 'os';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const args = process.argv.slice(2);
const command = args[0];

// Rileva il path di dist dal file corrente (bundled da esbuild)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// __dirname = .../plugin/dist/cli → risali per ottenere plugin/dist
const DIST_DIR = dirname(__dirname);

// ─── Embedded templates (included in the npm package, no external files needed) ───

/** Agent config template — __DIST_DIR__ is replaced at install time */
const AGENT_TEMPLATE = JSON.stringify({
  name: "contextkit-memory",
  description: "Agent with persistent cross-session memory. Uses ContextKit to remember context from previous sessions and automatically save what it learns.",
  model: "claude-sonnet-4",
  tools: ["read", "write", "shell", "glob", "grep", "web_search", "web_fetch", "@contextkit"],
  mcpServers: {
    contextkit: {
      command: "node",
      args: ["__DIST_DIR__/servers/mcp-server.js"]
    }
  },
  hooks: {
    agentSpawn: [{ command: "node __DIST_DIR__/hooks/agentSpawn.js", timeout_ms: 10000 }],
    userPromptSubmit: [{ command: "node __DIST_DIR__/hooks/userPromptSubmit.js", timeout_ms: 5000 }],
    postToolUse: [{ command: "node __DIST_DIR__/hooks/postToolUse.js", matcher: "*", timeout_ms: 5000 }],
    stop: [{ command: "node __DIST_DIR__/hooks/stop.js", timeout_ms: 10000 }]
  },
  resources: ["file://.kiro/steering/contextkit.md"]
}, null, 2);

/** Steering file content — embedded directly */
const STEERING_CONTENT = `# ContextKit - Persistent Memory

You have access to ContextKit, a persistent cross-session memory system.

## Available MCP Tools

### @contextkit/search
Search previous session memory. Use when:
- The user mentions past work
- You need context on previous decisions
- You want to check if a problem was already addressed

### @contextkit/get_context
Retrieve recent context for the current project. Use at the start of complex tasks to understand what was done before.

### @contextkit/timeline
Show chronological context around an observation. Use to understand the sequence of events.

### @contextkit/get_observations
Retrieve full details of specific observations. Use after \`search\` to drill down.

## Behavior

- Previous session context is automatically injected at startup
- Your actions (files written, commands run) are tracked automatically
- A summary is generated at the end of each session
- No manual saving needed: the system is fully automatic
`;

// ─── Environment diagnostics ───

interface CheckResult {
  name: string;
  ok: boolean;
  message: string;
  fix?: string;
}

/** Detect if running inside WSL */
function isWSL(): boolean {
  try {
    const rel = release().toLowerCase();
    if (rel.includes('microsoft') || rel.includes('wsl')) return true;
    if (existsSync('/proc/version')) {
      const proc = readFileSync('/proc/version', 'utf8').toLowerCase();
      return proc.includes('microsoft') || proc.includes('wsl');
    }
    return false;
  } catch {
    return false;
  }
}

/** Check if a command is available in PATH */
function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Detect if a path points to the Windows filesystem */
function isWindowsPath(p: string): boolean {
  return p.startsWith('/mnt/c') || p.startsWith('/mnt/d')
    || /^[A-Za-z]:[\\\/]/.test(p);
}

/** Run all environment checks and return results */
function runEnvironmentChecks(): CheckResult[] {
  const checks: CheckResult[] = [];
  const wsl = isWSL();

  // 1. OS detection
  const os = platform();
  checks.push({
    name: 'Operating system',
    ok: os === 'linux' || os === 'darwin',
    message: os === 'linux'
      ? (wsl ? 'Linux (WSL)' : 'Linux')
      : os === 'darwin' ? 'macOS' : `${os} (not officially supported)`,
  });

  // 2. WSL: Node must be native Linux (not Windows mounted via /mnt/c/)
  if (wsl) {
    const nodePath = process.execPath;
    const nodeOnWindows = isWindowsPath(nodePath);
    checks.push({
      name: 'WSL: Native Node.js',
      ok: !nodeOnWindows,
      message: nodeOnWindows
        ? `Node.js points to Windows: ${nodePath}`
        : `Native Linux Node.js: ${nodePath}`,
      fix: nodeOnWindows
        ? 'Install Node.js inside WSL:\n  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -\n  sudo apt-get install -y nodejs\n  Or use nvm: https://github.com/nvm-sh/nvm'
        : undefined,
    });

    // 3. WSL: npm global prefix must not point to Windows
    // npm may return paths in Linux format (/mnt/c/...) or Windows format (C:\...)
    try {
      const npmPrefix = execSync('npm prefix -g', { encoding: 'utf8' }).trim();
      const prefixOnWindows = isWindowsPath(npmPrefix);
      checks.push({
        name: 'WSL: npm global prefix',
        ok: !prefixOnWindows,
        message: prefixOnWindows
          ? `npm global prefix points to Windows: ${npmPrefix}`
          : `npm global prefix: ${npmPrefix}`,
        fix: prefixOnWindows
          ? 'Fix npm prefix:\n  mkdir -p ~/.npm-global\n  npm config set prefix ~/.npm-global\n  echo \'export PATH="$HOME/.npm-global/bin:$PATH"\' >> ~/.bashrc\n  source ~/.bashrc\n  Then reinstall: npm install -g kiro-memory'
          : undefined,
      });
    } catch {
      checks.push({
        name: 'WSL: npm global prefix',
        ok: false,
        message: 'Unable to determine npm prefix',
      });
    }

    // 3b. WSL: npm binary must be native Linux (not Windows npm)
    try {
      const npmPath = execSync('which npm', { encoding: 'utf8' }).trim();
      const npmOnWindows = isWindowsPath(npmPath);
      checks.push({
        name: 'WSL: npm binary',
        ok: !npmOnWindows,
        message: npmOnWindows
          ? `npm is the Windows version: ${npmPath}`
          : `Native Linux npm: ${npmPath}`,
        fix: npmOnWindows
          ? 'Your npm binary is the Windows version running inside WSL.\n  This causes EPERM/UNC errors when installing packages.\n  Install Node.js (includes npm) natively in WSL:\n    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash\n    source ~/.bashrc\n    nvm install 22\n  Or:\n    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -\n    sudo apt-get install -y nodejs'
          : undefined,
      });
    } catch {
      // which npm failed — non-blocking, npm is present if we got here
    }
  }

  // 4. Node.js >= 18
  const nodeVersion = parseInt(process.versions.node.split('.')[0]);
  checks.push({
    name: 'Node.js >= 18',
    ok: nodeVersion >= 18,
    message: `Node.js v${process.versions.node}`,
    fix: nodeVersion < 18
      ? 'Upgrade Node.js:\n  nvm install 22 && nvm use 22\n  Or visit: https://nodejs.org/'
      : undefined,
  });

  // 5. better-sqlite3 loadable
  let sqliteOk = false;
  let sqliteMsg = '';
  try {
    require('better-sqlite3');
    sqliteOk = true;
    sqliteMsg = 'Native module loaded successfully';
  } catch (err: any) {
    sqliteMsg = err.code === 'ERR_DLOPEN_FAILED'
      ? 'Incompatible native binary (invalid ELF header — likely platform mismatch)'
      : `Error: ${err.message}`;
  }
  checks.push({
    name: 'better-sqlite3',
    ok: sqliteOk,
    message: sqliteMsg,
    fix: !sqliteOk
      ? (wsl
        ? 'In WSL, rebuild the native module:\n  npm rebuild better-sqlite3\n  If that fails, reinstall:\n  npm install -g kiro-memory --build-from-source'
        : 'Rebuild the native module:\n  npm rebuild better-sqlite3')
      : undefined,
  });

  // 6. Build tools (Linux/WSL only — needed for native module compilation)
  if (os === 'linux') {
    const hasMake = commandExists('make');
    const hasGcc = commandExists('g++') || commandExists('gcc');
    const hasPython = commandExists('python3') || commandExists('python');
    const allPresent = hasMake && hasGcc && hasPython;
    const missing: string[] = [];
    if (!hasMake || !hasGcc) missing.push('build-essential');
    if (!hasPython) missing.push('python3');

    checks.push({
      name: 'Build tools (native modules)',
      ok: allPresent,
      message: allPresent
        ? 'make, g++, python3 available'
        : `Missing: ${missing.join(', ')}`,
      fix: !allPresent
        ? `Install required packages:\n  sudo apt-get update && sudo apt-get install -y ${missing.join(' ')}\n  Then reinstall: npm install -g kiro-memory --build-from-source`
        : undefined,
    });
  }

  return checks;
}

/** Print check results in a readable format */
function printChecks(checks: CheckResult[]): { hasErrors: boolean } {
  let hasErrors = false;
  console.log('');

  for (const check of checks) {
    const icon = check.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`  ${icon} ${check.name}: ${check.message}`);
    if (!check.ok && check.fix) {
      console.log(`    \x1b[33m→ Fix:\x1b[0m`);
      for (const line of check.fix.split('\n')) {
        console.log(`      ${line}`);
      }
    }
    if (!check.ok) hasErrors = true;
  }

  console.log('');
  return { hasErrors };
}

// ─── Helper: prompt interattivo ───

/** Chiede input all'utente via stdin e ritorna la risposta */
function askUser(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

/** Rileva la shell corrente dell'utente */
function detectShellRc(): { name: string; rcFile: string } {
  const shell = process.env.SHELL || '/bin/bash';
  if (shell.includes('zsh')) return { name: 'zsh', rcFile: join(homedir(), '.zshrc') };
  if (shell.includes('fish')) return { name: 'fish', rcFile: join(homedir(), '.config/fish/config.fish') };
  return { name: 'bash', rcFile: join(homedir(), '.bashrc') };
}

// ─── Install command ───

async function installKiro() {
  console.log('\n=== Kiro Memory - Installation ===\n');
  console.log('[1/3] Running environment checks...');

  const checks = runEnvironmentChecks();
  const { hasErrors } = printChecks(checks);

  if (hasErrors) {
    console.log('\x1b[31mInstallation aborted.\x1b[0m Fix the issues above and retry.');
    console.log('After fixing, run: kiro-memory install\n');
    process.exit(1);
  }

  // dist directory (where compiled files live)
  const distDir = DIST_DIR;

  // Destination directories
  const kiroDir = process.env.KIRO_CONFIG_DIR || join(homedir(), '.kiro');
  const agentsDir = join(kiroDir, 'agents');
  const settingsDir = join(kiroDir, 'settings');
  const steeringDir = join(kiroDir, 'steering');
  const dataDir = process.env.CONTEXTKIT_DATA_DIR || join(homedir(), '.contextkit');

  console.log('[2/3] Installing Kiro configuration...\n');

  // Create directories
  for (const dir of [agentsDir, settingsDir, steeringDir, dataDir]) {
    mkdirSync(dir, { recursive: true });
  }

  // Generate agent config with absolute paths (from embedded template)
  const agentConfig = AGENT_TEMPLATE.replace(/__DIST_DIR__/g, distDir);
  const agentDestPath = join(agentsDir, 'contextkit.json');
  writeFileSync(agentDestPath, agentConfig, 'utf8');
  console.log(`  → Agent config: ${agentDestPath}`);

  // Update/create mcp.json
  const mcpFilePath = join(settingsDir, 'mcp.json');
  let mcpConfig: any = { mcpServers: {} };

  if (existsSync(mcpFilePath)) {
    try {
      mcpConfig = JSON.parse(readFileSync(mcpFilePath, 'utf8'));
      if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
    } catch {
      // Corrupted file, overwrite
    }
  }

  mcpConfig.mcpServers.contextkit = {
    command: 'node',
    args: [join(distDir, 'servers', 'mcp-server.js')]
  };
  writeFileSync(mcpFilePath, JSON.stringify(mcpConfig, null, 2), 'utf8');
  console.log(`  → MCP config:   ${mcpFilePath}`);

  // Write steering file (from embedded content)
  const steeringDestPath = join(steeringDir, 'contextkit.md');
  writeFileSync(steeringDestPath, STEERING_CONTENT, 'utf8');
  console.log(`  → Steering:     ${steeringDestPath}`);

  console.log(`  → Data dir:     ${dataDir}`);

  // 3. Prompt per creazione alias
  console.log('\n[3/3] Shell alias setup\n');

  const { name: shellName, rcFile } = detectShellRc();
  const aliasLine = 'alias kiro="kiro-cli --agent contextkit-memory"';

  // Controlla se l'alias è già presente
  let aliasAlreadySet = false;
  if (existsSync(rcFile)) {
    const rcContent = readFileSync(rcFile, 'utf8');
    aliasAlreadySet = rcContent.includes('alias kiro=') && rcContent.includes('contextkit-memory');
  }

  if (aliasAlreadySet) {
    console.log(`  \x1b[32m✓\x1b[0m Alias already configured in ${rcFile}`);
  } else {
    // Box evidenziato per l'alias
    console.log('  \x1b[36m┌─────────────────────────────────────────────────────────┐\x1b[0m');
    console.log('  \x1b[36m│\x1b[0m  Without an alias, you must type every time:            \x1b[36m│\x1b[0m');
    console.log('  \x1b[36m│\x1b[0m    \x1b[2mkiro-cli --agent contextkit-memory\x1b[0m                    \x1b[36m│\x1b[0m');
    console.log('  \x1b[36m│\x1b[0m                                                         \x1b[36m│\x1b[0m');
    console.log('  \x1b[36m│\x1b[0m  With the alias, just type:                              \x1b[36m│\x1b[0m');
    console.log('  \x1b[36m│\x1b[0m    \x1b[1m\x1b[32mkiro\x1b[0m                                                 \x1b[36m│\x1b[0m');
    console.log('  \x1b[36m└─────────────────────────────────────────────────────────┘\x1b[0m');
    console.log('');

    const answer = await askUser(`  Add alias to ${rcFile}? [Y/n] `);

    if (answer === '' || answer === 'y' || answer === 'yes') {
      try {
        appendFileSync(rcFile, `\n# Kiro Memory — persistent memory alias\n${aliasLine}\n`);
        console.log(`\n  \x1b[32m✓\x1b[0m Alias added to ${rcFile}`);
        console.log(`  \x1b[33m→\x1b[0m Run \x1b[1msource ${rcFile}\x1b[0m or open a new terminal to activate it.`);
      } catch (err: any) {
        console.log(`\n  \x1b[31m✗\x1b[0m Could not write to ${rcFile}: ${err.message}`);
        console.log(`  \x1b[33m→\x1b[0m Add manually: ${aliasLine}`);
      }
    } else {
      console.log(`\n  Skipped. You can add it manually later:`);
      console.log(`    echo '${aliasLine}' >> ${rcFile}`);
    }
  }

  // Riepilogo finale
  console.log('\n\x1b[32m═══ Installation complete! ═══\x1b[0m\n');
  console.log('  Start Kiro with memory:');
  if (aliasAlreadySet) {
    console.log('    \x1b[1mkiro\x1b[0m');
  } else {
    console.log('    \x1b[1mkiro-cli --agent contextkit-memory\x1b[0m');
  }
  console.log('');
  console.log('  The worker starts automatically when a Kiro session begins.');
  console.log(`  Web dashboard: \x1b[4mhttp://localhost:3001\x1b[0m\n`);
}

// ─── Doctor command ───

async function runDoctor() {
  console.log('\n=== Kiro Memory - Diagnostics ===');

  const checks = runEnvironmentChecks();

  // Additional checks on installation status
  const kiroDir = process.env.KIRO_CONFIG_DIR || join(homedir(), '.kiro');
  const agentPath = join(kiroDir, 'agents', 'contextkit.json');
  const mcpPath = join(kiroDir, 'settings', 'mcp.json');
  const dataDir = process.env.CONTEXTKIT_DATA_DIR || join(homedir(), '.contextkit');

  checks.push({
    name: 'Kiro agent config',
    ok: existsSync(agentPath),
    message: existsSync(agentPath) ? agentPath : 'Not found',
    fix: !existsSync(agentPath) ? 'Run: kiro-memory install' : undefined,
  });

  let mcpOk = false;
  if (existsSync(mcpPath)) {
    try {
      const mcp = JSON.parse(readFileSync(mcpPath, 'utf8'));
      mcpOk = !!mcp.mcpServers?.contextkit;
    } catch {}
  }
  checks.push({
    name: 'MCP server configured',
    ok: mcpOk,
    message: mcpOk ? 'contextkit registered in mcp.json' : 'Not configured',
    fix: !mcpOk ? 'Run: kiro-memory install' : undefined,
  });

  checks.push({
    name: 'Data directory',
    ok: existsSync(dataDir),
    message: existsSync(dataDir) ? dataDir : 'Not created (will be created on first use)',
  });

  // Worker status check (informational, non-blocking)
  let workerOk = false;
  try {
    const port = process.env.KIRO_MEMORY_WORKER_PORT || '3001';
    execSync(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${port}/api/health`, {
      timeout: 2000,
      encoding: 'utf8'
    });
    workerOk = true;
  } catch {}
  checks.push({
    name: 'Worker service',
    ok: true,  // Non-blocking: starts automatically with Kiro
    message: workerOk ? 'Running on port 3001' : 'Not running (starts automatically with Kiro)',
  });

  const { hasErrors } = printChecks(checks);

  if (hasErrors) {
    console.log('Some checks failed. Fix the issues listed above.\n');
    process.exit(1);
  } else {
    console.log('All good! Kiro Memory is ready.\n');
  }
}

// ─── Main ───

async function main() {
  // Comandi che non richiedono database
  if (command === 'install') {
    await installKiro();
    return;
  }
  if (command === 'doctor') {
    await runDoctor();
    return;
  }

  const contextkit = createContextKit();

  try {
    switch (command) {
      case 'context':
      case 'ctx':
        await showContext(contextkit);
        break;

      case 'search':
        await searchContext(contextkit, args[1]);
        break;

      case 'observations':
      case 'obs':
        await showObservations(contextkit, parseInt(args[1]) || 10);
        break;

      case 'summaries':
      case 'sum':
        await showSummaries(contextkit, parseInt(args[1]) || 5);
        break;

      case 'add-observation':
      case 'add-obs':
        await addObservation(contextkit, args[1], args.slice(2).join(' '));
        break;

      case 'add-summary':
      case 'add-sum':
        await addSummary(contextkit, args.slice(1).join(' '));
        break;

      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      default:
        console.log('ContextKit CLI\n');
        showHelp();
        process.exit(1);
    }
  } finally {
    contextkit.close();
  }
}

async function showContext(contextkit: ReturnType<typeof createContextKit>) {
  const context = await contextkit.getContext();
  
  console.log(`\n📁 Project: ${context.project}\n`);
  
  console.log('📝 Recent Observations:');
  context.relevantObservations.slice(0, 5).forEach((obs, i) => {
    console.log(`  ${i + 1}. ${obs.title} (${new Date(obs.created_at).toLocaleDateString()})`);
    if (obs.text) {
      console.log(`     ${obs.text.substring(0, 100)}${obs.text.length > 100 ? '...' : ''}`);
    }
  });
  
  console.log('\n📊 Recent Summaries:');
  context.relevantSummaries.slice(0, 3).forEach((sum, i) => {
    console.log(`  ${i + 1}. ${sum.request || 'No request'} (${new Date(sum.created_at).toLocaleDateString()})`);
    if (sum.learned) {
      console.log(`     Learned: ${sum.learned.substring(0, 100)}${sum.learned.length > 100 ? '...' : ''}`);
    }
  });
  
  console.log('');
}

async function searchContext(contextkit: ReturnType<typeof createContextKit>, query: string) {
  if (!query) {
    console.error('Error: Please provide a search query');
    process.exit(1);
  }
  
  const results = await contextkit.search(query);
  
  console.log(`\n🔍 Search results for: "${query}"\n`);
  
  if (results.observations.length > 0) {
    console.log(`📋 Observations (${results.observations.length}):`);
    results.observations.forEach((obs, i) => {
      console.log(`  ${i + 1}. ${obs.title}`);
      if (obs.text) {
        console.log(`     ${obs.text.substring(0, 150)}${obs.text.length > 150 ? '...' : ''}`);
      }
    });
  }
  
  if (results.summaries.length > 0) {
    console.log(`\n📊 Summaries (${results.summaries.length}):`);
    results.summaries.forEach((sum, i) => {
      console.log(`  ${i + 1}. ${sum.request || 'No request'}`);
      if (sum.learned) {
        console.log(`     ${sum.learned.substring(0, 150)}${sum.learned.length > 150 ? '...' : ''}`);
      }
    });
  }
  
  if (results.observations.length === 0 && results.summaries.length === 0) {
    console.log('No results found.\n');
  } else {
    console.log('');
  }
}

async function showObservations(contextkit: ReturnType<typeof createContextKit>, limit: number) {
  const observations = await contextkit.getRecentObservations(limit);
  
  console.log(`\n📋 Last ${limit} Observations:\n`);
  
  observations.forEach((obs, i) => {
    console.log(`${i + 1}. ${obs.title} [${obs.type}]`);
    console.log(`   Date: ${new Date(obs.created_at).toLocaleString()}`);
    if (obs.text) {
      console.log(`   Content: ${obs.text.substring(0, 200)}${obs.text.length > 200 ? '...' : ''}`);
    }
    console.log('');
  });
}

async function showSummaries(contextkit: ReturnType<typeof createContextKit>, limit: number) {
  const summaries = await contextkit.getRecentSummaries(limit);
  
  console.log(`\n📊 Last ${limit} Summaries:\n`);
  
  summaries.forEach((sum, i) => {
    console.log(`${i + 1}. ${sum.request || 'No request'}`);
    console.log(`   Date: ${new Date(sum.created_at).toLocaleString()}`);
    if (sum.learned) {
      console.log(`   Learned: ${sum.learned}`);
    }
    if (sum.completed) {
      console.log(`   Completed: ${sum.completed}`);
    }
    if (sum.next_steps) {
      console.log(`   Next Steps: ${sum.next_steps}`);
    }
    console.log('');
  });
}

async function addObservation(
  contextkit: ReturnType<typeof createContextKit>, 
  title: string, 
  content: string
) {
  if (!title || !content) {
    console.error('Error: Please provide both title and content');
    process.exit(1);
  }
  
  const id = await contextkit.storeObservation({
    type: 'manual',
    title,
    content
  });
  
  console.log(`✅ Observation stored with ID: ${id}\n`);
}

async function addSummary(contextkit: ReturnType<typeof createContextKit>, content: string) {
  if (!content) {
    console.error('Error: Please provide summary content');
    process.exit(1);
  }
  
  const id = await contextkit.storeSummary({
    learned: content
  });
  
  console.log(`✅ Summary stored with ID: ${id}\n`);
}

function showHelp() {
  console.log(`Usage: kiro-memory <command> [options]

Setup:
  install                   Install hooks, MCP server, and agent config into Kiro CLI
  doctor                    Run environment diagnostics (checks Node, build tools, WSL, etc.)

Commands:
  context, ctx              Show current project context
  search <query>            Search across all context
  observations [limit]      Show recent observations (default: 10)
  summaries [limit]         Show recent summaries (default: 5)
  add-observation <title> <content>   Add a new observation
  add-summary <content>     Add a new summary
  help                      Show this help message

Examples:
  kiro-memory install
  kiro-memory doctor
  kiro-memory context
  kiro-memory search "authentication"
  kiro-memory observations 20
`);
}

main().catch(console.error);
