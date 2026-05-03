// 库街区 API 配置
export const KURO_API = {
  // 签到相关
  SIGNIN_URL: 'https://api.kurobbs.com/encourage/signIn/v2',
  SIGNIN_QUERY_URL: 'https://api.kurobbs.com/encourage/signIn/queryRecordV2',
  SIGNIN_INIT_URL: 'https://api.kurobbs.com/encourage/signIn/initSignInV2',
  
  // 游戏参数
  PARAM_GAME_ID: '3',
  PARAM_SERVER_ID: '76402e5b20be2c79f95d4f4ad1e41172',
  
  // 其他 API
  REFRESH_URL: 'https://api.kurobbs.com/aki/roleBox/akiBox/refreshData',
  BASE_DATA_URL: 'https://api.kurobbs.com/aki/roleBox/akiBox/baseData',
  ROLE_DATA_URL: 'https://api.kurobbs.com/aki/roleBox/akiBox/roleData',
} as const;

// 请求头配置
export function getHeaders(token: string, isWeb: boolean, devCode?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Origin': 'https://www.kurobbs.com',
    'Referer': 'https://www.kurobbs.com/',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'token': token,
    'source': isWeb ? 'web' : 'android',
  };

  if (devCode) {
    headers['devCode'] = devCode;
  }

  return headers;
}
