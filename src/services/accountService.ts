import type { Database } from '../db/database.ts';
import type { Account, CreateAccountRequest, UpdateAccountRequest } from '../types/index.ts';
import { kuroApi } from './kuroApi.ts';

export class AccountService {
  constructor(private db: Database) {}

  /**
   * 获取所有账号
   */
  getAllAccounts(): Account[] {
    return this.db.getAllAccounts();
  }

  /**
   * 获取启用的账号
   */
  getActiveAccounts(): Account[] {
    return this.db.getActiveAccounts();
  }

  /**
   * 获取单个账号
   */
  getAccount(id: number): Account | null {
    return this.db.getAccountById(id);
  }

  /**
   * 创建账号
   */
  createAccount(request: CreateAccountRequest): { success: boolean; id?: number; message?: string } {
    try {
      // 检查必填字段
      if (!request.userId || !request.roleId || !request.token) {
        return { success: false, message: '缺少必填字段: userId, roleId, token' };
      }

      const id = this.db.createAccount({
        userId: request.userId,
        roleId: request.roleId,
        token: request.token,
        devCode: request.devCode || '',
        isWeb: request.isWeb ?? false,
        nickname: request.nickname || null,
        serverId: request.serverId || '76402e5b20be2c79f95d4f4ad1e41172',
        isActive: true,
        isValid: true,
        lastSignTime: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return { success: true, id };
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        return { success: false, message: '该账号已存在 (userId + roleId 重复)' };
      }
      return { success: false, message: error instanceof Error ? error.message : '创建账号失败' };
    }
  }

  /**
   * 批量创建账号
   */
  batchCreateAccounts(requests: CreateAccountRequest[]): {
    success: boolean;
    results: Array<{ success: boolean; id?: number; message?: string }>;
    total: number;
    successCount: number;
  } {
    const results: Array<{ success: boolean; id?: number; message?: string }> = [];
    let successCount = 0;

    for (const request of requests) {
      const result = this.createAccount(request);
      results.push(result);
      if (result.success) successCount++;
    }

    return {
      success: successCount > 0,
      results,
      total: requests.length,
      successCount,
    };
  }

  /**
   * 更新账号
   */
  updateAccount(id: number, request: UpdateAccountRequest): { success: boolean; message?: string } {
    const account = this.db.getAccountById(id);
    if (!account) {
      return { success: false, message: '账号不存在' };
    }

    const updateData: Partial<Account> = {};
    
    if (request.userId !== undefined) updateData.userId = request.userId;
    if (request.roleId !== undefined) updateData.roleId = request.roleId;
    if (request.token !== undefined) updateData.token = request.token;
    if (request.devCode !== undefined) updateData.devCode = request.devCode;
    if (request.isWeb !== undefined) updateData.isWeb = request.isWeb;
    if (request.nickname !== undefined) updateData.nickname = request.nickname;
    if (request.serverId !== undefined) updateData.serverId = request.serverId;
    if (request.isActive !== undefined) updateData.isActive = request.isActive;

    const success = this.db.updateAccount(id, updateData);
    
    if (success) {
      return { success: true };
    } else {
      return { success: false, message: '更新失败' };
    }
  }

  /**
   * 删除账号
   */
  deleteAccount(id: number): { success: boolean; message?: string } {
    const account = this.db.getAccountById(id);
    if (!account) {
      return { success: false, message: '账号不存在' };
    }

    const success = this.db.deleteAccount(id);
    
    if (success) {
      return { success: true };
    } else {
      return { success: false, message: '删除失败' };
    }
  }

  /**
   * 批量删除账号
   */
  batchDeleteAccounts(ids: number[]): {
    success: boolean;
    deleted: number;
    failed: number;
  } {
    let deleted = 0;
    let failed = 0;

    for (const id of ids) {
      const result = this.deleteAccount(id);
      if (result.success) {
        deleted++;
      } else {
        failed++;
      }
    }

    return {
      success: deleted > 0,
      deleted,
      failed,
    };
  }

  /**
   * 验证账号有效性
   */
  async validateAccount(id: number): Promise<{
    success: boolean;
    valid: boolean;
    message: string;
  }> {
    const account = this.db.getAccountById(id);
    if (!account) {
      return { success: false, valid: false, message: '账号不存在' };
    }

    const result = await kuroApi.validateAccount(account);
    
    // 更新账号有效性状态
    this.db.updateAccountValidity(id, result.valid);

    return {
      success: true,
      valid: result.valid,
      message: result.message,
    };
  }

  /**
   * 批量验证账号有效性
   */
  async validateAllAccounts(): Promise<{
    total: number;
    valid: number;
    invalid: number;
    results: Array<{ id: number; userId: string; valid: boolean; message: string }>;
  }> {
    const accounts = this.getAllAccounts();
    const results: Array<{ id: number; userId: string; valid: boolean; message: string }> = [];
    let valid = 0;
    let invalid = 0;

    for (const account of accounts) {
      const result = await kuroApi.validateAccount(account);
      this.db.updateAccountValidity(account.id, result.valid);
      
      results.push({
        id: account.id,
        userId: account.userId,
        valid: result.valid,
        message: result.message,
      });

      if (result.valid) {
        valid++;
      } else {
        invalid++;
      }

      // 添加延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return {
      total: accounts.length,
      valid,
      invalid,
      results,
    };
  }

  /**
   * 切换账号启用状态
   */
  toggleAccountStatus(id: number): { success: boolean; isActive?: boolean; message?: string } {
    const account = this.db.getAccountById(id);
    if (!account) {
      return { success: false, message: '账号不存在' };
    }

    const newStatus = !account.isActive;
    const success = this.db.updateAccount(id, { isActive: newStatus });

    if (success) {
      return { success: true, isActive: newStatus };
    } else {
      return { success: false, message: '更新失败' };
    }
  }

  /**
   * 获取账号统计
   */
  getStats(): {
    total: number;
    active: number;
    valid: number;
    inactive: number;
    invalid: number;
  } {
    const accounts = this.getAllAccounts();
    const total = accounts.length;
    const active = accounts.filter(a => a.isActive).length;
    const valid = accounts.filter(a => a.isValid && a.isActive).length;
    
    return {
      total,
      active,
      valid,
      inactive: total - active,
      invalid: active - valid,
    };
  }

  /**
   * 导出账号数据
   */
  exportAccounts(): Array<{
    userId: string;
    roleId: string;
    token: string;
    devCode: string;
    isWeb: boolean;
    nickname: string | null;
    serverId: string;
  }> {
    const accounts = this.getAllAccounts();
    return accounts.map(a => ({
      userId: a.userId,
      roleId: a.roleId,
      token: a.token,
      devCode: a.devCode,
      isWeb: a.isWeb,
      nickname: a.nickname,
      serverId: a.serverId,
    }));
  }

  /**
   * 导入账号数据
   */
  importAccounts(data: Array<{
    userId: string;
    roleId: string;
    token: string;
    devCode?: string;
    isWeb?: boolean;
    nickname?: string;
    serverId?: string;
  }>): {
    success: boolean;
    total: number;
    successCount: number;
    failedCount: number;
    errors: string[];
  } {
    const errors: string[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const result = this.createAccount({
        userId: item.userId,
        roleId: item.roleId,
        token: item.token,
        devCode: item.devCode,
        isWeb: item.isWeb,
        nickname: item.nickname,
        serverId: item.serverId,
      });

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
        errors.push(`第 ${i + 1} 行: ${result.message}`);
      }
    }

    return {
      success: successCount > 0,
      total: data.length,
      successCount,
      failedCount,
      errors,
    };
  }
}
