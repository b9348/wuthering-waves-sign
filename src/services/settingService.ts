import type { Database } from '../db/database.ts';
import type { SystemConfig, Setting } from '../types/index.ts';

export class SettingService {
  constructor(private db: Database) {}

  /**
   * 获取系统配置
   */
  getConfig(): SystemConfig {
    return {
      autoSign: this.getBoolean('auto_sign', false),
      signTime: this.getString('sign_time', '09:00'),
      notifyType: this.getString('notify_type', 'none') as SystemConfig['notifyType'],
      notifyWebhook: this.getString('notify_webhook', '') || null,
      notifyEmail: this.getString('notify_email', '') || null,
    };
  }

  /**
   * 更新系统配置
   */
  updateConfig(config: Partial<SystemConfig>): void {
    if (config.autoSign !== undefined) {
      this.set('auto_sign', config.autoSign.toString());
    }
    if (config.signTime !== undefined) {
      this.set('sign_time', config.signTime);
    }
    if (config.notifyType !== undefined) {
      this.set('notify_type', config.notifyType);
    }
    if (config.notifyWebhook !== undefined) {
      this.set('notify_webhook', config.notifyWebhook || '');
    }
    if (config.notifyEmail !== undefined) {
      this.set('notify_email', config.notifyEmail || '');
    }
  }

  /**
   * 获取所有设置
   */
  getAll(): Setting[] {
    return this.db.getAllSettings();
  }

  /**
   * 获取字符串设置
   */
  getString(key: string, defaultValue: string = ''): string {
    return this.db.getSetting(key) || defaultValue;
  }

  /**
   * 获取布尔设置
   */
  getBoolean(key: string, defaultValue: boolean = false): boolean {
    const value = this.db.getSetting(key);
    if (value === null) return defaultValue;
    return value === 'true';
  }

  /**
   * 获取数字设置
   */
  getNumber(key: string, defaultValue: number = 0): number {
    const value = this.db.getSetting(key);
    if (value === null) return defaultValue;
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * 设置值
   */
  set(key: string, value: string): void {
    this.db.setSetting(key, value);
  }
}
