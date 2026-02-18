#!/bin/bash
# Script di installazione ContextKit per Kiro CLI
# Uso: bash scripts/install-kiro.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/plugin/dist"
KIRO_DIR="$HOME/.kiro"
KIRO_AGENTS_DIR="$KIRO_DIR/agents"
KIRO_MCP_DIR="$KIRO_DIR/settings"
DATA_DIR="$HOME/.contextkit"

echo "=== Installazione ContextKit per Kiro CLI ==="
echo ""

# 1. Verifica prerequisiti
echo "[1/6] Verifica prerequisiti..."
if ! command -v node &> /dev/null; then
    echo "ERRORE: Node.js non trovato. Installalo prima: https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "ERRORE: Node.js >= 18 richiesto. Versione attuale: $(node -v)"
    exit 1
fi

if ! command -v kiro-cli &> /dev/null; then
    echo "AVVISO: kiro-cli non trovato nel PATH. Assicurati che sia installato."
fi

# 2. Build
echo "[2/6] Compilazione..."
cd "$PROJECT_DIR"
npm install --silent 2>/dev/null || true
npm run build

# 3. Crea directory
echo "[3/6] Creazione directory..."
mkdir -p "$KIRO_AGENTS_DIR"
mkdir -p "$KIRO_MCP_DIR"
mkdir -p "$DATA_DIR"

# 4. Genera configurazione agente con path assoluti
echo "[4/6] Installazione agente Kiro..."
sed "s|__CONTEXTKIT_DIST__|$DIST_DIR|g" "$PROJECT_DIR/kiro-agent/contextkit.json" > "$KIRO_AGENTS_DIR/contextkit.json"
echo "  → $KIRO_AGENTS_DIR/contextkit.json"

# 5. Configura MCP
echo "[5/6] Configurazione MCP..."
MCP_FILE="$KIRO_MCP_DIR/mcp.json"
if [ -f "$MCP_FILE" ]; then
    # Aggiungi contextkit al file esistente (se non già presente)
    if ! grep -q '"contextkit"' "$MCP_FILE" 2>/dev/null; then
        # Usa node per merge JSON sicuro
        node -e "
          const fs = require('fs');
          const existing = JSON.parse(fs.readFileSync('$MCP_FILE', 'utf8'));
          if (!existing.mcpServers) existing.mcpServers = {};
          existing.mcpServers.contextkit = {
            command: 'node',
            args: ['$DIST_DIR/servers/mcp-server.js']
          };
          fs.writeFileSync('$MCP_FILE', JSON.stringify(existing, null, 2));
        "
        echo "  → Aggiunto a $MCP_FILE"
    else
        echo "  → contextkit già presente in $MCP_FILE"
    fi
else
    # Crea nuovo file
    cat > "$MCP_FILE" << MCPEOF
{
  "mcpServers": {
    "contextkit": {
      "command": "node",
      "args": ["$DIST_DIR/servers/mcp-server.js"]
    }
  }
}
MCPEOF
    echo "  → Creato $MCP_FILE"
fi

# 6. Copia steering file (opzionale)
echo "[6/6] Copia steering file..."
STEERING_DIR="$KIRO_DIR/steering"
mkdir -p "$STEERING_DIR"
if [ ! -f "$STEERING_DIR/contextkit.md" ]; then
    cp "$PROJECT_DIR/kiro-agent/steering.md" "$STEERING_DIR/contextkit.md"
    echo "  → $STEERING_DIR/contextkit.md"
else
    echo "  → Steering file già presente"
fi

echo ""
echo "=== Installazione completata ==="
echo ""
echo "Per usare ContextKit con Kiro CLI:"
echo "  1. Avvia il worker:  cd $PROJECT_DIR && npm run worker:start"
echo "  2. Usa l'agente:     kiro-cli --agent contextkit-memory"
echo ""
echo "Oppure usa l'agente default con hook automatici."
echo ""
echo "Directory dati: $DATA_DIR"
echo "Database:       $DATA_DIR/contextkit.db"
echo "Log:            $DATA_DIR/logs/"
