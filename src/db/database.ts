import { Database as SQLiteDB } from '@db/sqlite';
import type { Account, SignRecord, Log, Setting } from '../types/index.ts';

export class Database {
  private db: SQLiteDB;

  constructor() {
    // 确保数据目录存在
    try {
      Deno.mkdirSync('./data', { recursive: true });
    } catch {
      // 目录已存在
    }
    
    this.db = new SQLiteDB('./data/sign.db');
    this.initTables();
  }

  private initTables(): void {
    // 账号表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        token TEXT NOT NULL,
        dev_code TEXT DEFAULT '',
        is_web INTEGER DEFAULT 0,
        nickname TEXT,
        server_id TEXT DEFAULT '76402e5b20be2c79f95d4f4ad1e41172',
        is_active INTEGER DEFAULT 1,
        is_valid INTEGER DEFAULT 1,
        last_sign_time TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, role_id)
      )
    `);

    // 签到记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sign_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        sign_date TEXT NOT NULL,
        status TEXT NOT NULL,
        reward TEXT,
        message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    // 签到统计表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sign_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        total_days INTEGER DEFAULT 0,
        signed_days INTEGER DEFAULT 0,
        consecutive_days INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        UNIQUE(account_id, month)
      )
    `);

    // 系统配置表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 操作日志表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 插入默认配置
    this.initDefaultSettings();
  }

  private initDefaultSettings(): void {
    const defaults = [
      { key: 'auto_sign', value: 'false' },
      { key: 'sign_time', value: '09:00' },
      { key: 'notify_type', value: 'none' },
      { key: 'notify_webhook', value: '' },
      { key: 'notify_email', value: '' },
    ];

    for (const item of defaults) {
      this.db.exec(
        `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
        [item.key, item.value]
      );
    }
  }

  // ========== 账号相关操作 ==========
  
  getAllAccounts(): Account[] {
    const rows = this.db.prepare(
      'SELECT * FROM accounts ORDER BY created_at DESC'
    ).all();
    return rows.map(row => this.parseAccount(row));
  }

  getActiveAccounts(): Account[] {
    const rows = this.db.prepare(
      'SELECT * FROM accounts WHERE is_active = 1 ORDER BY created_at DESC'
    ).all();
    return rows.map(row => this.parseAccount(row));
  }

  getAccountById(id: number): Account | null {
    const row = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    return row ? this.parseAccount(row) : null;
  }

  createAccount(account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): number {
    const result = this.db.prepare(`
      INSERT INTO accounts (user_id, role_id, token, dev_code, is_web, nickname, server_id, is_active, is_valid, last_sign_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      account.userId,
      account.roleId,
      account.token,
      account.devCode,
      account.isWeb ? 1 : 0,
      account.nickname,
      account.serverId,
      account.isActive ? 1 : 0,
      account.isValid ? 1 : 0,
      account.lastSignTime
    );
    return result.lastInsertRowId as number;
  }

  updateAccount(id: number, account: Partial<Account>): boolean {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (account.userId !== undefined) {
      fields.push('user_id = ?');
      values.push(account.userId);
    }
    if (account.roleId !== undefined) {
      fields.push('role_id = ?');
      values.push(account.roleId);
    }
    if (account.token !== undefined) {
      fields.push('token = ?');
      values.push(account.token);
    }
    if (account.devCode !== undefined) {
      fields.push('dev_code = ?');
      values.push(account.devCode);
    }
    if (account.isWeb !== undefined) {
      fields.push('is_web = ?');
      values.push(account.isWeb ? 1 : 0);
    }
    if (account.nickname !== undefined) {
      fields.push('nickname = ?');
      values.push(account.nickname);
    }
    if (account.serverId !== undefined) {
      fields.push('server_id = ?');
      values.push(account.serverId);
    }
    if (account.isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(account.isActive ? 1 : 0);
    }
    if (account.isValid !== undefined) {
      fields.push('is_valid = ?');
      values.push(account.isValid ? 1 : 0);
    }
    if (account.lastSignTime !== undefined) {
      fields.push('last_sign_time = ?');
      values.push(account.lastSignTime);
    }

    if (fields.length === 0) return false;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = this.db.prepare(`
      UPDATE accounts SET ${fields.join(', ')} WHERE id = ?
    `).run(...values);

    return result.changes > 0;
  }

  deleteAccount(id: number): boolean {
    const result = this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    return result.changes > 0;
  }

  updateAccountValidity(id: number, isValid: boolean): boolean {
    const result = this.db.prepare(`
      UPDATE accounts SET is_valid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(isValid ? 1 : 0, id);
    return result.changes > 0;
  }

  // ========== 签到记录相关操作 ==========

  createSignRecord(record: Omit<SignRecord, 'id' | 'createdAt'>): number {
    const result = this.db.prepare(`
      INSERT INTO sign_records (account_id, sign_date, status, reward, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(record.accountId, record.signDate, record.status, record.reward, record.message);
    return result.lastInsertRowId as number;
  }

  getSignRecordsByAccount(accountId: number, limit = 30): SignRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM sign_records 
      WHERE account_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(accountId, limit);
    return rows.map(row => this.parseSignRecord(row));
  }

  getTodaySignRecords(): SignRecord[] {
    const today = new Date().toISOString().split('T')[0];
    const rows = this.db.prepare(`
      SELECT sr.* FROM sign_records sr
      INNER JOIN accounts a ON sr.account_id = a.id
      WHERE sr.sign_date = ? AND a.is_active = 1
      ORDER BY sr.created_at DESC
    `).all(today);
    return rows.map(row => this.parseSignRecord(row));
  }

  getRecentSignRecords(limit = 10): SignRecord[] {
    const rows = this.db.prepare(`
      SELECT sr.*, a.user_id, a.nickname FROM sign_records sr
      INNER JOIN accounts a ON sr.account_id = a.id
      ORDER BY sr.created_at DESC
      LIMIT ?
    `).all(limit);
    return rows.map(row => this.parseSignRecord(row));
  }

  hasSignedToday(accountId: number): boolean {
    const today = new Date().toISOString().split('T')[0];
    const row = this.db.prepare(`
      SELECT COUNT(*) as count FROM sign_records 
      WHERE account_id = ? AND sign_date = ? AND status IN ('success', 'already_signed')
    `).get(accountId, today);
    return (row?.count as number) > 0;
  }

  // ========== 日志相关操作 ==========

  createLog(log: Omit<Log, 'id' | 'createdAt'>): number {
    const result = this.db.prepare(`
      INSERT INTO logs (type, message, details)
      VALUES (?, ?, ?)
    `).run(log.type, log.message, log.details);
    return result.lastInsertRowId as number;
  }

  getRecentLogs(limit = 20): Log[] {
    const rows = this.db.prepare(`
      SELECT * FROM logs ORDER BY created_at DESC LIMIT ?
    `).all(limit);
    return rows.map(row => this.parseLog(row));
  }

  clearOldLogs(days = 30): void {
    this.db.prepare(`
      DELETE FROM logs WHERE created_at < datetime('now', '-${days} days')
    `).run();
  }

  // ========== 设置相关操作 ==========

  getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value as string : null;
  }

  setSetting(key: string, value: string): void {
    this.db.prepare(`
      INSERT INTO settings (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(key, value);
  }

  getAllSettings(): Setting[] {
    const rows = this.db.prepare('SELECT * FROM settings').all();
    return rows.map(row => ({
      key: row.key as string,
      value: row.value as string,
    }));
  }

  // ========== 统计相关 ==========

  getAccountStats(): { total: number; active: number; valid: number } {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM accounts').get().count as number;
    const active = this.db.prepare('SELECT COUNT(*) as count FROM accounts WHERE is_active = 1').get().count as number;
    const valid = this.db.prepare('SELECT COUNT(*) as count FROM accounts WHERE is_valid = 1 AND is_active = 1').get().count as number;
    return { total, active, valid };
  }

  getTodayStats(): { signed: number; failed: number; pending: number } {
    const today = new Date().toISOString().split('T')[0];
    const activeAccounts = this.db.prepare(`
      SELECT COUNT(*) as count FROM accounts WHERE is_active = 1
    `).get().count as number;

    const signed = this.db.prepare(`
      SELECT COUNT(DISTINCT account_id) as count FROM sign_records 
      WHERE sign_date = ? AND status IN ('success', 'already_signed')
    `).get(today).count as number;

    const failed = this.db.prepare(`
      SELECT COUNT(DISTINCT account_id) as count FROM sign_records 
      WHERE sign_date = ? AND status = 'failed'
    `).get(today).count as number;

    const pending = activeAccounts - signed - failed;

    return { signed, failed, pending: Math.max(0, pending) };
  }

  // ========== 数据解析 ==========

  private parseAccount(row: Record<string, unknown>): Account {
    return {
      id: row.id as number,
      userId: row.user_id as string,
      roleId: row.role_id as string,
      token: row.token as string,
      devCode: row.dev_code as string,
      isWeb: (row.is_web as number) === 1,
      nickname: row.nickname as string | null,
      serverId: row.server_id as string,
      isActive: (row.is_active as number) === 1,
      isValid: (row.is_valid as number) === 1,
      lastSignTime: row.last_sign_time as string | null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private parseSignRecord(row: Record<string, unknown>): SignRecord {
    return {
      id: row.id as number,
      accountId: row.account_id as number,
      signDate: row.sign_date as string,
      status: row.status as 'success' | 'failed' | 'skipped' | 'already_signed',
      reward: row.reward as string | null,
      message: row.message as string,
      createdAt: row.created_at as string,
    };
  }

  private parseLog(row: Record<string, unknown>): Log {
    return {
      id: row.id as number,
      type: row.type as 'info' | 'warning' | 'error' | 'success',
      message: row.message as string,
      details: row.details as string | null,
      createdAt: row.created_at as string,
    };
  }
}
