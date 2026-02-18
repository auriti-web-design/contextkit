/**
 * Kiro Memory Viewer — utility di formattazione
 */

/**
 * Restituisce la classe CSS del badge in base al tipo di osservazione.
 */
export function getBadgeClass(type: string): string {
  const map: Record<string, string> = {
    'file-write': 'badge--file-write',
    'command': 'badge--command',
    'research': 'badge--research',
    'delegation': 'badge--delegation',
    'tool-use': 'badge--tool-use'
  };
  return map[type] || 'badge--default';
}

/**
 * Converte un epoch (secondi) in una stringa relativa leggibile.
 * Es: "2 min fa", "3h fa", "ieri", "5 giorni fa"
 */
export function timeAgo(epochSeconds: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - epochSeconds);

  if (diff < 60) return 'ora';
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m} min fa`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h}h fa`;
  }
  if (diff < 172800) return 'ieri';
  if (diff < 604800) {
    const d = Math.floor(diff / 86400);
    return `${d} giorni fa`;
  }
  if (diff < 2592000) {
    const w = Math.floor(diff / 604800);
    return `${w} sett. fa`;
  }
  // Oltre un mese → data breve
  const date = new Date(epochSeconds * 1000);
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}
