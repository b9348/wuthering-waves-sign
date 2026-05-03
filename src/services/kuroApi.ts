import { KURO_API, getHeaders } from '../utils/apiConfig.ts';
import type { 
  Account, 
  KuroApiResponse, 
  SignInitData, 
  SignRecordData,
  SignResult 
} from '../types/index.ts';

export class KuroApiService {
  
  /**
   * 初始化签到数据 - 获取签到奖励列表和当前签到状态
   */
  async getSignInitData(account: Account): Promise<{
    success: boolean;
    isSigned: boolean;
    signDays: number;
    goods: Array<{
      goodsName: string;
      goodsNum: number;
      goodsUrl: string;
      serialNum: number;
      sign: boolean;
    }>;
    message?: string;
  }> {
    try {
      const url = new URL(KURO_API.SIGNIN_INIT_URL);
      url.searchParams.append('gameId', KURO_API.PARAM_GAME_ID);
      url.searchParams.append('serverId', account.serverId || KURO_API.PARAM_SERVER_ID);
      url.searchParams.append('roleId', account.roleId);
      url.searchParams.append('userId', account.userId);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: getHeaders(account.token, account.isWeb, account.devCode),
      });

      if (!response.ok) {
        return {
          success: false,
          isSigned: false,
          signDays: 0,
          goods: [],
          message: `HTTP 错误: ${response.status}`,
        };
      }

      const data: KuroApiResponse<SignInitData> = await response.json();

      if (data.code !== 200) {
        return {
          success: false,
          isSigned: false,
          signDays: 0,
          goods: [],
          message: data.msg || '获取签到数据失败',
        };
      }

      const goods = data.data.signInGoodsConfigs.map((item, index) => ({
        goodsName: item.goodsName,
        goodsNum: item.goodsNum,
        goodsUrl: item.goodsUrl,
        serialNum: item.serialNum,
        sign: index < data.data.sigInNum,
      }));

      return {
        success: true,
        isSigned: data.data.isSigIn,
        signDays: data.data.sigInNum,
        goods,
      };
    } catch (error) {
      return {
        success: false,
        isSigned: false,
        signDays: 0,
        goods: [],
        message: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 执行签到
   */
  async doSign(account: Account): Promise<SignResult> {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // 先检查今天是否已经签到
      const initData = await this.getSignInitData(account);
      if (initData.isSigned) {
        return {
          accountId: account.id,
          userId: account.userId,
          nickname: account.nickname,
          status: 'already_signed',
          message: '今日已签到',
          reward: null,
          signDate: today,
        };
      }

      // 执行签到
      const month = new Date().getMonth() + 1;
      const url = new URL(KURO_API.SIGNIN_URL);
      url.searchParams.append('gameId', KURO_API.PARAM_GAME_ID);
      url.searchParams.append('serverId', account.serverId || KURO_API.PARAM_SERVER_ID);
      url.searchParams.append('roleId', account.roleId);
      url.searchParams.append('userId', account.userId);
      url.searchParams.append('reqMonth', month.toString().padStart(2, '0'));

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: getHeaders(account.token, account.isWeb, account.devCode),
      });

      if (!response.ok) {
        return {
          accountId: account.id,
          userId: account.userId,
          nickname: account.nickname,
          status: 'failed',
          message: `HTTP 错误: ${response.status}`,
          reward: null,
          signDate: today,
        };
      }

      const data: KuroApiResponse<unknown> = await response.json();

      if (data.code === 200 || data.msg?.includes('请求成功')) {
        // 签到成功，查询今天的奖励
        const reward = await this.getTodayReward(account);
        
        return {
          accountId: account.id,
          userId: account.userId,
          nickname: account.nickname,
          status: 'success',
          message: '签到成功',
          reward: reward,
          signDate: today,
        };
      } else if (data.msg?.includes('请勿重复签到') || data.msg?.includes('已签到')) {
        return {
          accountId: account.id,
          userId: account.userId,
          nickname: account.nickname,
          status: 'already_signed',
          message: '今日已签到',
          reward: null,
          signDate: today,
        };
      } else {
        return {
          accountId: account.id,
          userId: account.userId,
          nickname: account.nickname,
          status: 'failed',
          message: data.msg || '签到失败',
          reward: null,
          signDate: today,
        };
      }
    } catch (error) {
      return {
        accountId: account.id,
        userId: account.userId,
        nickname: account.nickname,
        status: 'failed',
        message: error instanceof Error ? error.message : '未知错误',
        reward: null,
        signDate: today,
      };
    }
  }

  /**
   * 查询签到记录
   */
  async querySignRecords(account: Account): Promise<{
    success: boolean;
    records: Array<{
      goodsName: string;
      goodsNum: number;
      signTime: string;
    }>;
    message?: string;
  }> {
    try {
      const url = new URL(KURO_API.SIGNIN_QUERY_URL);
      url.searchParams.append('gameId', KURO_API.PARAM_GAME_ID);
      url.searchParams.append('serverId', account.serverId || KURO_API.PARAM_SERVER_ID);
      url.searchParams.append('roleId', account.roleId);
      url.searchParams.append('userId', account.userId);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: getHeaders(account.token, account.isWeb, account.devCode),
      });

      if (!response.ok) {
        return {
          success: false,
          records: [],
          message: `HTTP 错误: ${response.status}`,
        };
      }

      const data: KuroApiResponse<SignRecordData[]> = await response.json();

      if (data.code !== 200) {
        return {
          success: false,
          records: [],
          message: data.msg || '查询签到记录失败',
        };
      }

      return {
        success: true,
        records: data.data.map(item => ({
          goodsName: item.goodsName,
          goodsNum: item.goodsNum,
          signTime: item.signTime,
        })),
      };
    } catch (error) {
      return {
        success: false,
        records: [],
        message: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 获取今日签到奖励
   */
  private async getTodayReward(account: Account): Promise<string | null> {
    const records = await this.querySignRecords(account);
    if (records.success && records.records.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const todayRecord = records.records.find(r => r.signTime.startsWith(today));
      if (todayRecord) {
        return `${todayRecord.goodsName} x${todayRecord.goodsNum}`;
      }
    }
    return null;
  }

  /**
   * 验证账号有效性
   */
  async validateAccount(account: Account): Promise<{
    valid: boolean;
    message: string;
    nickname?: string;
  }> {
    try {
      const result = await this.getSignInitData(account);
      
      if (result.success) {
        return {
          valid: true,
          message: '账号有效',
        };
      } else if (result.message?.includes('token') || result.message?.includes('登录')) {
        return {
          valid: false,
          message: 'Token 已过期或无效',
        };
      } else {
        return {
          valid: false,
          message: result.message || '账号验证失败',
        };
      }
    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : '验证过程出错',
      };
    }
  }

  /**
   * 刷新游戏数据（用于获取最新角色信息）
   */
  async refreshGameData(account: Account): Promise<{
    success: boolean;
    nickname?: string;
    message?: string;
  }> {
    try {
      const url = new URL(KURO_API.REFRESH_URL);
      url.searchParams.append('gameId', KURO_API.PARAM_GAME_ID);
      url.searchParams.append('serverId', account.serverId || KURO_API.PARAM_SERVER_ID);
      url.searchParams.append('roleId', account.roleId);
      url.searchParams.append('userId', account.userId);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: getHeaders(account.token, account.isWeb, account.devCode),
      });

      if (!response.ok) {
        return {
          success: false,
          message: `HTTP 错误: ${response.status}`,
        };
      }

      const data = await response.json();

      if (data.code === 200) {
        return {
          success: true,
          message: '数据刷新成功',
        };
      } else {
        return {
          success: false,
          message: data.msg || '刷新失败',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
      };
    }
  }
}

export const kuroApi = new KuroApiService();
