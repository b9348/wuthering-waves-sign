// 账号类型
export interface Account {
  id: number;
  userId: string;
  roleId: string;
  token: string;
  devCode: string;
  isWeb: boolean;
  nickname: string | null;
  serverId: string;
  isActive: boolean;
  isValid: boolean;
  lastSignTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountRequest {
  userId: string;
  roleId: string;
  token: string;
  devCode?: string;
  isWeb?: boolean;
  nickname?: string;
  serverId?: string;
}

export interface UpdateAccountRequest {
  userId?: string;
  roleId?: string;
  token?: string;
  devCode?: string;
  isWeb?: boolean;
  nickname?: string;
  serverId?: string;
  isActive?: boolean;
}

// 签到记录类型
export interface SignRecord {
  id: number;
  accountId: number;
  signDate: string;
  status: 'success' | 'failed' | 'skipped' | 'already_signed';
  reward: string | null;
  message: string;
  createdAt: string;
}

// 签到商品类型
export interface SignGood {
  id: number;
  goodsName: string;
  goodsNum: number;
  goodsUrl: string;
  serialNum: number;
  sign: boolean;
}

// 签到结果类型
export interface SignResult {
  accountId: number;
  userId: string;
  nickname: string | null;
  status: 'success' | 'failed' | 'skipped' | 'already_signed';
  message: string;
  reward: string | null;
  signDate: string;
}

// 日志类型
export interface Log {
  id: number;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details: string | null;
  createdAt: string;
}

// 设置类型
export interface Setting {
  key: string;
  value: string;
}

// 系统配置
export interface SystemConfig {
  autoSign: boolean;
  signTime: string;
  notifyType: 'none' | 'webhook' | 'email';
  notifyWebhook: string | null;
  notifyEmail: string | null;
}

// 仪表盘数据
export interface DashboardData {
  totalAccounts: number;
  activeAccounts: number;
  validAccounts: number;
  todaySigned: number;
  todayFailed: number;
  todayPending: number;
  recentLogs: Log[];
  recentSignRecords: SignRecord[];
}

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  code: number;
}

// 库街区 API 响应类型
export interface KuroApiResponse<T = unknown> {
  code: number;
  msg: string;
  data: T;
  success: boolean;
}

// 签到初始化响应
export interface SignInitData {
  sigInNum: number;
  isSigIn: boolean;
  signInGoodsConfigs: SignGood[];
}

// 签到记录查询响应
export interface SignRecordData {
  goodsName: string;
  goodsNum: number;
  goodsUrl: string;
  signTime: string;
  type: number;
}
