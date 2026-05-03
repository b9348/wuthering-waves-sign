import type { AccountService } from './accountService.ts';
import type { SignService } from './signService.ts';
import type { LogService } from './logService.ts';
import type { SettingService } from './settingService.ts';

export class SignScheduler {
  constructor(
    private accountService: AccountService,
    private signService: SignService,
    private logService: LogService,
    private settingService: SettingService,
  ) {}

  /**
   * 启动定时调度
   */
  start(): void {
    // 每分钟检查一次是否需要执行签到
    Deno.cron('SignTimeCheck', '* * * * *', async () => {
      await this.checkAndExecute();
    });

    // 每天凌晨清理旧日志
    Deno.cron('ClearOldLogs', '0 0 * * *', () => {
      this.logService.clearOldLogs(30);
    });

    this.logService.info('定时调度器已启动');
  }

  /**
   * 检查并执行签到
   */
  private async checkAndExecute(): Promise<void> {
    const config = this.settingService.getConfig();
    
    if (!config.autoSign) {
      return;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    if (currentTime !== config.signTime) {
      return;
    }

    this.logService.info(`开始执行定时签到任务，时间: ${currentTime}`);
    
    try {
      const result = await this.signService.signAllAccounts();
      
      const message = `定时签到完成: 总计 ${result.total}, 成功 ${result.success}, 失败 ${result.failed}, 已签到 ${result.alreadySigned}, 跳过 ${result.skipped}`;
      this.logService.success(message);

      // 如果有失败，发送通知
      if (result.failed > 0 && config.notifyType !== 'none') {
        await this.sendNotification(`签到失败 ${result.failed} 个账号`, result.results);
      }
    } catch (error) {
      this.logService.error('定时签到执行失败', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 发送通知
   */
  private async sendNotification(message: string, results: unknown[]): Promise<void> {
    const config = this.settingService.getConfig();
    
    if (config.notifyType === 'webhook' && config.notifyWebhook) {
      try {
        await fetch(config.notifyWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `【鸣潮签到】${message}`,
            details: results,
          }),
        });
      } catch (error) {
        this.logService.error('发送 Webhook 通知失败', String(error));
      }
    }
    
    // 邮件通知可以在这里实现
  }

  /**
   * 立即执行签到（手动触发）
   */
  async executeNow(accountIds?: number[]): Promise<{
    total: number;
    success: number;
    failed: number;
    alreadySigned: number;
    skipped: number;
  }> {
    this.logService.info('手动触发签到任务');
    
    try {
      const result = accountIds 
        ? await this.signService.signBatch(accountIds)
        : await this.signService.signAllAccounts();
      
      const message = `手动签到完成: 总计 ${result.total}, 成功 ${result.success}, 失败 ${result.failed}, 已签到 ${result.alreadySigned}, 跳过 ${result.skipped}`;
      this.logService.success(message);
      
      return {
        total: result.total,
        success: result.success,
        failed: result.failed,
        alreadySigned: result.alreadySigned,
        skipped: result.skipped,
      };
    } catch (error) {
      this.logService.error('手动签到执行失败', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}
