# ContextKit - Memoria Persistente

Hai accesso a ContextKit, un sistema di memoria persistente cross-sessione.

## Tool MCP Disponibili

### @contextkit/search
Cerca nella memoria delle sessioni precedenti. Usalo quando:
- L'utente menziona lavoro fatto in passato
- Hai bisogno di contesto su decisioni precedenti
- Vuoi verificare se un problema è già stato affrontato

### @contextkit/get_context
Recupera il contesto recente per il progetto corrente. Usalo all'inizio di task complessi per capire cosa è stato fatto.

### @contextkit/timeline
Mostra il contesto cronologico attorno a un'osservazione. Usalo per capire la sequenza di eventi.

### @contextkit/get_observations
Recupera i dettagli completi di osservazioni specifiche. Usa dopo `search` per approfondire.

## Comportamento

- Il contesto delle sessioni precedenti viene iniettato automaticamente all'avvio
- Le tue azioni (file scritti, comandi eseguiti) vengono tracciate automaticamente
- Un sommario viene generato alla fine di ogni sessione
- Non serve salvare manualmente: il sistema è automatico
