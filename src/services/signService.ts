import type { Database } from '../db/database.ts';
import type { Account, SignResult, SignRecord } from '../types/index.ts';
import { kuroApi } from './kuroApi.ts';

export class SignService {
  constructor(private db: Database) {}

  /**
   * 执行单个账号签到
   */
  async signAccount(account: Account): Promise<SignResult> {
    // 检查账号是否启用
    if (!account.isActive) {
      const today = new Date().toISOString().split('T')[0];
      return {
        accountId: account.id,
        userId: account.userId,
        nickname: account.nickname,
        status: 'skipped',
        message: '账号已禁用',
        reward: null,
        signDate: today,
      };
    }

    // 执行签到
    const result = await kuroApi.doSign(account);

    // 保存签到记录
    this.db.createSignRecord({
      accountId: account.id,
      signDate: result.signDate,
      status: result.status,
      reward: result.reward,
      message: result.message,
    });

    // 更新最后签到时间
    if (result.status === 'success' || result.status === 'already_signed') {
      this.db.updateAccount(account.id, {
        lastSignTime: new Date().toISOString(),
      });
    }

    return result;
  }

  /**
   * 执行所有账号签到
   */
  async signAllAccounts(): Promise<{
    total: number;
    success: number;
    failed: number;
    alreadySigned: number;
    skipped: number;
    results: SignResult[];
  }> {
    const accounts = this.db.getActiveAccounts();
    const results: SignResult[] = [];
    
    let success = 0;
    let failed = 0;
    let alreadySigned = 0;
    let skipped = 0;

    for (const account of accounts) {
      // 检查今天是否已经签到成功
      if (this.db.hasSignedToday(account.id)) {
        const today = new Date().toISOString().split('T')[0];
        results.push({
          accountId: account.id,
          userId: account.userId,
          nickname: account.nickname,
          status: 'already_signed',
          message: '今日已签到（数据库记录）',
          reward: null,
          signDate: today,
        });
        alreadySigned++;
        continue;
      }

      const result = await this.signAccount(account);
      results.push(result);

      switch (result.status) {
        case 'success':
          success++;
          break;
        case 'failed':
          failed++;
          break;
        case 'already_signed':
          alreadySigned++;
          break;
        case 'skipped':
          skipped++;
          break;
      }

      // 添加延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return {
      total: accounts.length,
      success,
      failed,
      alreadySigned,
      skipped,
      results,
    };
  }

  /**
   * 批量签到（指定账号ID列表）
   */
  async signBatch(accountIds: number[]): Promise<{
    total: number;
    success: number;
    failed: number;
    alreadySigned: number;
    skipped: number;
    results: SignResult[];
  }> {
    const results: SignResult[] = [];
    let success = 0;
    let failed = 0;
    let alreadySigned = 0;
    let skipped = 0;

    for (const id of accountIds) {
      const account = this.db.getAccountById(id);
      if (!account) {
        const today = new Date().toISOString().split('T')[0];
        results.push({
          accountId: id,
          userId: 'unknown',
          nickname: null,
          status: 'skipped',
          message: '账号不存在',
          reward: null,
          signDate: today,
        });
        skipped++;
        continue;
      }

      const result = await this.signAccount(account);
      results.push(result);

      switch (result.status) {
        case 'success':
          success++;
          break;
        case 'failed':
          failed++;
          break;
        case 'already_signed':
          alreadySigned++;
          break;
        case 'skipped':
          skipped++;
          break;
      }

      // 添加延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return {
      total: accountIds.length,
      success,
      failed,
      alreadySigned,
      skipped,
      results,
    };
  }

  /**
   * 获取签到初始化数据（奖励列表）
   */
  async getSignInitData(accountId: number): Promise<{
    success: boolean;
    data?: {
      isSigned: boolean;
      signDays: number;
      goods: Array<{
        goodsName: string;
        goodsNum: number;
        goodsUrl: string;
        serialNum: number;
        sign: boolean;
      }>;
    };
    message?: string;
  }> {
    const account = this.db.getAccountById(accountId);
    if (!account) {
      return { success: false, message: '账号不存在' };
    }

    return await kuroApi.getSignInitData(account);
  }

  /**
   * 获取账号签到记录
   */
  getSignRecords(accountId: number, limit = 30): SignRecord[] {
    return this.db.getSignRecordsByAccount(accountId, limit);
  }

  /**
   * 获取今日签到统计
   */
  getTodayStats(): {
    total: number;
    signed: number;
    failed: number;
    pending: number;
  } {
    return this.db.getTodayStats();
  }

  /**
   * 获取最近签到记录
   */
  getRecentRecords(limit = 10): SignRecord[] {
    return this.db.getRecentSignRecords(limit);
  }

  /**
   * 检查账号今日是否已签到
   */
  hasSignedToday(accountId: number): boolean {
    return this.db.hasSignedToday(accountId);
  }

  /**
   * 获取账号签到统计
   */
  getAccountSignStats(accountId: number): {
    totalRecords: number;
    successCount: number;
    failedCount: number;
    consecutiveDays: number;
  } {
    const records = this.db.getSignRecordsByAccount(accountId, 365);
    
    const successCount = records.filter(r => r.status === 'success' || r.status === 'already_signed').length;
    const failedCount = records.filter(r => r.status === 'failed').length;
    
    // 计算连续签到天数
    let consecutiveDays = 0;
    const today = new Date();
    
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const hasSign = records.some(r => 
        r.signDate === dateStr && 
        (r.status === 'success' || r.status === 'already_signed')
      );
      
      if (hasSign) {
        consecutiveDays++;
      } else if (i > 0) {
        break;
      }
    }

    return {
      totalRecords: records.length,
      successCount,
      failedCount,
      consecutiveDays,
    };
  }
}
