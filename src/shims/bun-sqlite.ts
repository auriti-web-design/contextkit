/**
 * Shim bun:sqlite → better-sqlite3
 *
 * Fornisce un'API compatibile con bun:sqlite usando better-sqlite3
 * per consentire l'esecuzione su Node.js puro.
 */

import BetterSqlite3 from 'better-sqlite3';

/**
 * Classe Database compatibile con bun:sqlite
 */
export class Database {
  private _db: BetterSqlite3.Database;

  constructor(path: string, options?: { create?: boolean; readwrite?: boolean }) {
    this._db = new BetterSqlite3(path, {
      // better-sqlite3 crea il file di default (non serve 'create')
      readonly: options?.readwrite === false ? true : false
    });
  }

  /**
   * Esegui una query SQL senza risultati
   */
  run(sql: string, params?: any[]): { lastInsertRowid: number | bigint; changes: number } {
    const stmt = this._db.prepare(sql);
    const result = params ? stmt.run(...params) : stmt.run();
    return result;
  }

  /**
   * Prepara una query con interfaccia compatibile bun:sqlite
   */
  query(sql: string): BunQueryCompat {
    return new BunQueryCompat(this._db, sql);
  }

  /**
   * Crea una transazione
   */
  transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
    return this._db.transaction(fn) as any;
  }

  /**
   * Chiudi la connessione
   */
  close(): void {
    this._db.close();
  }
}

/**
 * Wrapper query compatibile con l'API bun:sqlite Statement
 */
class BunQueryCompat {
  private _db: BetterSqlite3.Database;
  private _sql: string;

  constructor(db: BetterSqlite3.Database, sql: string) {
    this._db = db;
    this._sql = sql;
  }

  /**
   * Restituisce tutte le righe
   */
  all(...params: any[]): any[] {
    const stmt = this._db.prepare(this._sql);
    return params.length > 0 ? stmt.all(...params) : stmt.all();
  }

  /**
   * Restituisce la prima riga o null
   */
  get(...params: any[]): any {
    const stmt = this._db.prepare(this._sql);
    return params.length > 0 ? stmt.get(...params) : stmt.get();
  }

  /**
   * Esegui senza risultati
   */
  run(...params: any[]): { lastInsertRowid: number | bigint; changes: number } {
    const stmt = this._db.prepare(this._sql);
    return params.length > 0 ? stmt.run(...params) : stmt.run();
  }
}

export default { Database };
