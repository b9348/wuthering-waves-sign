import type { Database } from '../db/database.ts';
import type { Log } from '../types/index.ts';

export class LogService {
  constructor(private db: Database) {}

  /**
   * 添加日志
   */
  addLog(type: Log['type'], message: string, details?: string): void {
    this.db.createLog({
      type,
      message,
      details: details || null,
    });
  }

  /**
   * 添加信息日志
   */
  info(message: string, details?: string): void {
    this.addLog('info', message, details);
    console.log(`[INFO] ${message}`);
  }

  /**
   * 添加成功日志
   */
  success(message: string, details?: string): void {
    this.addLog('success', message, details);
    console.log(`[SUCCESS] ${message}`);
  }

  /**
   * 添加警告日志
   */
  warning(message: string, details?: string): void {
    this.addLog('warning', message, details);
    console.warn(`[WARNING] ${message}`);
  }

  /**
   * 添加错误日志
   */
  error(message: string, details?: string): void {
    this.addLog('error', message, details);
    console.error(`[ERROR] ${message}`);
  }

  /**
   * 获取最近日志
   */
  getRecentLogs(limit = 20): Log[] {
    return this.db.getRecentLogs(limit);
  }

  /**
   * 清理旧日志
   */
  clearOldLogs(days = 30): void {
    this.db.clearOldLogs(days);
    this.info(`已清理 ${days} 天前的日志`);
  }
}
