/**
 * Deno Deploy 入口文件
 * 适配无文件系统环境的云部署
 */

import { Hono } from 'hono';
import { html } from 'hono/html';

// ============ 配置 ============
const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD') || 'admin123';

// ============ 内存数据库 ============
class MemoryDatabase {
  private accounts: Map<number, any> = new Map();
  private signRecords: Map<number, any> = new Map();
  private logs: Map<number, any> = new Map();
  private settings: Map<string, string> = new Map();
  private idCounters = { accounts: 1, signRecords: 1, logs: 1 };

  constructor() {
    this.settings.set('auto_sign', 'false');
    this.settings.set('sign_time', '09:00');
    this.settings.set('notify_type', 'none');
    this.settings.set('notify_webhook', '');
    this.settings.set('notify_email', '');
  }

  getAllAccounts() {
    return Array.from(this.accounts.values()).sort((a, b) => b.id - a.id);
  }

  getActiveAccounts() {
    return this.getAllAccounts().filter((a: any) => a.isActive);
  }

  getAccountById(id: number) {
    return this.accounts.get(id) || null;
  }

  createAccount(account: any) {
    const id = this.idCounters.accounts++;
    const newAccount = { ...account, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    this.accounts.set(id, newAccount);
    return id;
  }

  updateAccount(id: number, data: any) {
    const account = this.accounts.get(id);
    if (!account) return false;
    this.accounts.set(id, { ...account, ...data, updatedAt: new Date().toISOString() });
    return true;
  }

  deleteAccount(id: number) {
    return this.accounts.delete(id);
  }

  createSignRecord(record: any) {
    const id = this.idCounters.signRecords++;
    const newRecord = { ...record, id, createdAt: new Date().toISOString() };
    this.signRecords.set(id, newRecord);
    return id;
  }

  getSignRecordsByAccount(accountId: number, limit = 30) {
    return Array.from(this.signRecords.values())
      .filter((r: any) => r.accountId === accountId)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  getRecentSignRecords(limit = 10) {
    return Array.from(this.signRecords.values())
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  hasSignedToday(accountId: number) {
    const today = new Date().toISOString().split('T')[0];
    return Array.from(this.signRecords.values()).some((r: any) =>
      r.accountId === accountId && r.signDate === today &&
      (r.status === 'success' || r.status === 'already_signed')
    );
  }

  createLog(log: any) {
    const id = this.idCounters.logs++;
    const newLog = { ...log, id, createdAt: new Date().toISOString() };
    this.logs.set(id, newLog);
    console.log(`[${log.type.toUpperCase()}] ${log.message}`);
    return id;
  }

  getRecentLogs(limit = 20) {
    return Array.from(this.logs.values())
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  getSetting(key: string) {
    return this.settings.get(key) || null;
  }

  setSetting(key: string, value: string) {
    this.settings.set(key, value);
  }

  getAccountStats() {
    const accounts = this.getAllAccounts();
    return {
      total: accounts.length,
      active: accounts.filter((a: any) => a.isActive).length,
      valid: accounts.filter((a: any) => a.isValid && a.isActive).length,
    };
  }

  getTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    const activeAccounts = this.getActiveAccounts();
    const todayRecords = Array.from(this.signRecords.values()).filter((r: any) => r.signDate === today);
    const signed = new Set(todayRecords.filter((r: any) => r.status === 'success' || r.status === 'already_signed').map((r: any) => r.accountId)).size;
    const failed = new Set(todayRecords.filter((r: any) => r.status === 'failed').map((r: any) => r.accountId)).size;
    return { signed, failed, pending: Math.max(0, activeAccounts.length - signed - failed) };
  }
}

const db = new MemoryDatabase();

// ============ 页面模板 ============
const pageHtml = html`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>鸣潮签到管理系统</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>[x-cloak] { display: none !important; }</style>
</head>
<body class="bg-gray-100 min-h-screen" x-data="app()" x-init="init()">
  <!-- 登录对话框 -->
  <div x-show="!isLoggedIn" x-cloak class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
      <div class="text-center mb-6">
        <i class="fas fa-lock text-4xl text-blue-600 mb-3"></i>
        <h2 class="text-xl font-bold">管理员登录</h2>
        <p class="text-gray-500 text-sm mt-1">请输入密码访问系统</p>
      </div>
      <div class="space-y-4">
        <input x-model="loginPassword" type="password" placeholder="请输入密码" class="w-full border rounded px-4 py-3 text-center" @keyup.enter="doLogin()">
        <button @click="doLogin()" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-medium transition">
          登录
        </button>
      </div>
      <p x-show="loginError" x-text="loginError" class="text-red-500 text-sm text-center mt-3"></p>
    </div>
  </div>

  <nav x-show="isLoggedIn" class="bg-blue-600 text-white shadow-lg">
    <div class="container mx-auto px-4 py-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <i class="fas fa-gamepad text-2xl"></i>
          <h1 class="text-xl font-bold">鸣潮签到管理系统</h1>
        </div>
        <div class="flex items-center space-x-4">
          <span class="text-sm" x-text="'系统状态: ' + (loading ? '加载中...' : '正常')"></span>
          <button @click="refreshData()" class="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded text-sm transition">
            <i class="fas fa-sync" :class="{ 'fa-spin': loading }"></i> 刷新
          </button>
          <button @click="logout()" class="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm transition" title="退出登录">
            <i class="fas fa-sign-out-alt"></i> 退出
          </button>
        </div>
      </div>
    </div>
  </nav>

  <div class="container mx-auto px-4 py-6">
    <!-- 统计卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-500 text-sm">总账号数</p>
            <p class="text-2xl font-bold" x-text="stats.totalAccounts">0</p>
          </div>
          <div class="bg-blue-100 p-3 rounded-full"><i class="fas fa-users text-blue-600"></i></div>
        </div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-500 text-sm">有效账号</p>
            <p class="text-2xl font-bold text-green-600" x-text="stats.validAccounts">0</p>
          </div>
          <div class="bg-green-100 p-3 rounded-full"><i class="fas fa-check-circle text-green-600"></i></div>
        </div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-500 text-sm">今日已签到</p>
            <p class="text-2xl font-bold text-purple-600" x-text="stats.todaySigned">0</p>
          </div>
          <div class="bg-purple-100 p-3 rounded-full"><i class="fas fa-calendar-check text-purple-600"></i></div>
        </div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-500 text-sm">待签到</p>
            <p class="text-2xl font-bold text-orange-600" x-text="stats.todayPending">0</p>
          </div>
          <div class="bg-orange-100 p-3 rounded-full"><i class="fas fa-clock text-orange-600"></i></div>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="bg-white rounded-lg shadow p-4 mb-6">
      <div class="flex flex-wrap gap-3">
        <button @click="showAddModal = true" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition">
          <i class="fas fa-plus mr-2"></i>添加账号
        </button>
        <button @click="signAll()" :disabled="signing" class="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded transition">
          <i class="fas fa-play mr-2" :class="{ 'fa-spin': signing }"></i>全部签到
        </button>
        <button @click="validateAll()" :disabled="validating" class="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded transition">
          <i class="fas fa-check-double mr-2" :class="{ 'fa-spin': validating }"></i>验证全部
        </button>
        <button @click="exportAccounts()" class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded transition">
          <i class="fas fa-download mr-2"></i>导出
        </button>
        <label class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition cursor-pointer">
          <i class="fas fa-upload mr-2"></i>导入
          <input type="file" @change="importAccounts(\$event)" accept=".json" class="hidden">
        </label>
      </div>
    </div>

    <!-- 账号列表 -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <h2 class="text-lg font-semibold">账号列表</h2>
        <input x-model="searchQuery" type="text" placeholder="搜索账号..." class="border rounded px-3 py-1 text-sm">
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户ID</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色ID</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">昵称</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <template x-for="account in filteredAccounts" :key="account.id">
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm" x-text="account.id"></td>
                <td class="px-4 py-3 text-sm font-mono" x-text="account.userId"></td>
                <td class="px-4 py-3 text-sm font-mono" x-text="account.roleId"></td>
                <td class="px-4 py-3 text-sm" x-text="account.nickname || '-'"></td>
                <td class="px-4 py-3">
                  <span :class="account.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'" class="px-2 py-1 text-xs rounded-full" x-text="account.isActive ? '启用' : '禁用'"></span>
                  <span :class="account.isValid ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'" class="px-2 py-1 text-xs rounded-full ml-1" x-text="account.isValid ? '有效' : '无效'"></span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex space-x-2">
                    <button @click="signAccount(account.id)" :disabled="signing" class="text-green-600 hover:text-green-800" title="签到"><i class="fas fa-play"></i></button>
                    <button @click="validateAccount(account.id)" :disabled="validating" class="text-blue-600 hover:text-blue-800" title="验证"><i class="fas fa-check"></i></button>
                    <button @click="editAccount(account)" class="text-yellow-600 hover:text-yellow-800" title="编辑"><i class="fas fa-edit"></i></button>
                    <button @click="toggleAccount(account.id)" class="text-purple-600 hover:text-purple-800" title="启用/禁用"><i class="fas" :class="account.isActive ? 'fa-pause' : 'fa-play'"></i></button>
                    <button @click="deleteAccount(account.id)" class="text-red-600 hover:text-red-800" title="删除"><i class="fas fa-trash"></i></button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 最近日志 -->
    <div class="bg-white rounded-lg shadow mt-6">
      <div class="px-4 py-3 border-b border-gray-200"><h2 class="text-lg font-semibold">最近日志</h2></div>
      <div class="p-4">
        <div class="space-y-2 max-h-60 overflow-y-auto">
          <template x-for="log in recentLogs" :key="log.id">
            <div :class="{ 'bg-green-50 border-green-200': log.type === 'success', 'bg-red-50 border-red-200': log.type === 'error', 'bg-yellow-50 border-yellow-200': log.type === 'warning', 'bg-blue-50 border-blue-200': log.type === 'info' }" class="border rounded p-2 text-sm">
              <div class="flex justify-between">
                <span :class="{ 'text-green-700': log.type === 'success', 'text-red-700': log.type === 'error', 'text-yellow-700': log.type === 'warning', 'text-blue-700': log.type === 'info' }" class="font-medium" x-text="log.message"></span>
                <span class="text-gray-400 text-xs" x-text="new Date(log.createdAt).toLocaleString()"></span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- 添加账号模态框 -->
  <div x-show="showAddModal" x-cloak class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="px-6 py-4 border-b border-gray-200"><h3 class="text-lg font-semibold">添加账号</h3></div>
      <div class="px-6 py-4 space-y-4">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">用户ID</label><input x-model="newAccount.userId" type="text" class="w-full border rounded px-3 py-2" placeholder="请输入用户ID"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">角色ID</label><input x-model="newAccount.roleId" type="text" class="w-full border rounded px-3 py-2" placeholder="请输入角色ID"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Token</label><input x-model="newAccount.token" type="text" class="w-full border rounded px-3 py-2" placeholder="请输入Token"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">昵称 (可选)</label><input x-model="newAccount.nickname" type="text" class="w-full border rounded px-3 py-2" placeholder="请输入昵称"></div>
      </div>
      <div class="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
        <button @click="showAddModal = false" class="px-4 py-2 text-gray-600 hover:text-gray-800">取消</button>
        <button @click="addAccount()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">添加</button>
      </div>
    </div>
  </div>

  <!-- 编辑账号模态框 -->
  <div x-show="showEditModal" x-cloak class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="px-6 py-4 border-b border-gray-200"><h3 class="text-lg font-semibold">编辑账号</h3></div>
      <div class="px-6 py-4 space-y-4">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">用户ID</label><input x-model="editAccountData.userId" type="text" class="w-full border rounded px-3 py-2"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">角色ID</label><input x-model="editAccountData.roleId" type="text" class="w-full border rounded px-3 py-2"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Token</label><input x-model="editAccountData.token" type="text" class="w-full border rounded px-3 py-2"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">昵称</label><input x-model="editAccountData.nickname" type="text" class="w-full border rounded px-3 py-2"></div>
      </div>
      <div class="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
        <button @click="showEditModal = false" class="px-4 py-2 text-gray-600 hover:text-gray-800">取消</button>
        <button @click="updateAccount()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">保存</button>
      </div>
    </div>
  </div>

  <!-- 提示消息 -->
  <div x-show="toast.show" x-transition class="fixed bottom-4 right-4 px-6 py-3 rounded shadow-lg z-50" :class="{ 'bg-green-500 text-white': toast.type === 'success', 'bg-red-500 text-white': toast.type === 'error', 'bg-yellow-500 text-white': toast.type === 'warning' }">
    <span x-text="toast.message"></span>
  </div>

  <script>
    function app() {
      return {
        loading: false, signing: false, validating: false,
        accounts: [], stats: { totalAccounts: 0, validAccounts: 0, todaySigned: 0, todayPending: 0 },
        recentLogs: [], searchQuery: '',
        showAddModal: false, showEditModal: false,
        newAccount: { userId: '', roleId: '', token: '', nickname: '' },
        editAccountData: { id: null, userId: '', roleId: '', token: '', nickname: '' },
        toast: { show: false, message: '', type: 'success' },
        // 登录相关
        isLoggedIn: false, loginPassword: '', loginError: '',

        get filteredAccounts() {
          return this.accounts.filter(a => !this.searchQuery || a.userId.includes(this.searchQuery) || a.roleId.includes(this.searchQuery) || (a.nickname && a.nickname.includes(this.searchQuery)));
        },

        async init() {
          // 检查本地存储的登录状态
          const savedAuth = localStorage.getItem('admin_auth');
          if (savedAuth) {
            // 验证 token 是否有效
            const res = await fetch('/api/auth/check', { headers: { 'Authorization': 'Bearer ' + savedAuth } });
            if (res.ok) this.isLoggedIn = true;
            else localStorage.removeItem('admin_auth');
          }
          if (this.isLoggedIn) await this.refreshData();
        },

        async doLogin() {
          if (!this.loginPassword) { this.loginError = '请输入密码'; return; }
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: this.loginPassword })
          });
          const data = await res.json();
          if (data.success) {
            localStorage.setItem('admin_auth', data.token);
            this.isLoggedIn = true;
            this.loginError = '';
            this.loginPassword = '';
            await this.refreshData();
          } else {
            this.loginError = data.message || '密码错误';
          }
        },

        logout() {
          localStorage.removeItem('admin_auth');
          this.isLoggedIn = false;
          this.loginPassword = '';
        },

        async refreshData() {
          this.loading = true;
          try {
            const [accRes, dashRes] = await Promise.all([fetch('/api/accounts'), fetch('/api/dashboard')]);
            const accData = await accRes.json(), dashData = await dashRes.json();
            if (accData.success) this.accounts = accData.data;
            if (dashData.success) { this.stats = dashData.data; this.recentLogs = dashData.data.recentLogs; }
          } catch (e) { this.showToast('加载失败', 'error'); }
          this.loading = false;
        },

        async addAccount() {
          const res = await fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.newAccount) });
          const data = await res.json();
          if (data.success) { this.showToast('添加成功', 'success'); this.showAddModal = false; this.newAccount = { userId: '', roleId: '', token: '', nickname: '' }; await this.refreshData(); }
          else this.showToast(data.message || '添加失败', 'error');
        },

        editAccount(account) { this.editAccountData = { ...account }; this.showEditModal = true; },

        async updateAccount() {
          const res = await fetch(\`/api/accounts/\${this.editAccountData.id}\`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.editAccountData) });
          const data = await res.json();
          if (data.success) { this.showToast('更新成功', 'success'); this.showEditModal = false; await this.refreshData(); }
          else this.showToast(data.message || '更新失败', 'error');
        },

        async deleteAccount(id) {
          if (!confirm('确定删除?')) return;
          const res = await fetch(\`/api/accounts/\${id}\`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) { this.showToast('删除成功', 'success'); await this.refreshData(); }
          else this.showToast(data.message || '删除失败', 'error');
        },

        async toggleAccount(id) {
          const res = await fetch(\`/api/accounts/\${id}/toggle\`, { method: 'POST' });
          const data = await res.json();
          if (data.success) { this.showToast(data.data.isActive ? '已启用' : '已禁用', 'success'); await this.refreshData(); }
        },

        async signAccount(id) {
          this.signing = true;
          const res = await fetch(\`/api/sign/\${id}\`, { method: 'POST' });
          const data = await res.json();
          this.showToast(data.data?.message || '签到完成', data.data?.status === 'success' ? 'success' : 'warning');
          await this.refreshData(); this.signing = false;
        },

        async signAll() {
          this.signing = true;
          const res = await fetch('/api/sign/all', { method: 'POST' });
          const data = await res.json();
          this.showToast(\`签到完成: 成功 \${data.data?.success || 0}\`, 'success');
          await this.refreshData(); this.signing = false;
        },

        async validateAccount(id) {
          this.validating = true;
          const res = await fetch(\`/api/accounts/\${id}/validate\`, { method: 'POST' });
          const data = await res.json();
          this.showToast(data.data?.message || '验证完成', data.data?.valid ? 'success' : 'error');
          await this.refreshData(); this.validating = false;
        },

        async validateAll() {
          this.validating = true;
          const res = await fetch('/api/accounts/validate-all', { method: 'POST' });
          const data = await res.json();
          this.showToast(\`验证完成: 有效 \${data.data?.valid || 0}\`, 'success');
          await this.refreshData(); this.validating = false;
        },

        async exportAccounts() {
          const res = await fetch('/api/accounts/export/data');
          const data = await res.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = \`accounts_\${new Date().toISOString().split('T')[0]}.json\`; a.click(); URL.revokeObjectURL(url);
          this.showToast('导出成功', 'success');
        },

        async importAccounts(e) {
          const file = e.target.files[0]; if (!file) return;
          const text = await file.text();
          const accounts = JSON.parse(text);
          const res = await fetch('/api/accounts/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(accounts) });
          const data = await res.json();
          this.showToast(\`导入成功: \${data.data?.successCount || 0}\`, 'success');
          await this.refreshData(); e.target.value = '';
        },

        showToast(message, type = 'success') { this.toast = { show: true, message, type }; setTimeout(() => this.toast.show = false, 3000); }
      }
    }
  </script>
</body>
</html>`;

// ============ API 路由 ============
const app = new Hono();

// 页面路由
app.get('/', (c) => c.html(pageHtml));

// 账号 API
app.get('/api/accounts', (c) => c.json({ success: true, data: db.getAllAccounts(), code: 200 }));

app.post('/api/accounts', async (c) => {
  const body = await c.req.json();
  if (!body.userId || !body.roleId || !body.token) {
    return c.json({ success: false, message: '缺少必填字段', code: 400 }, 400);
  }
  const id = db.createAccount({
    userId: body.userId, roleId: body.roleId, token: body.token,
    devCode: body.devCode || '', isWeb: body.isWeb ?? false,
    nickname: body.nickname || null, serverId: body.serverId || '76402e5b20be2c79f95d4f4ad1e41172',
    isActive: true, isValid: true, lastSignTime: null,
  });
  db.createLog({ type: 'success', message: `创建账号: ${body.userId}`, details: null });
  return c.json({ success: true, data: { id }, code: 200 });
});

app.put('/api/accounts/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json();
  const success = db.updateAccount(id, body);
  return c.json({ success, code: success ? 200 : 400 });
});

app.delete('/api/accounts/:id', (c) => {
  const id = parseInt(c.req.param('id'));
  const success = db.deleteAccount(id);
  return c.json({ success, code: success ? 200 : 400 });
});

app.post('/api/accounts/:id/toggle', (c) => {
  const id = parseInt(c.req.param('id'));
  const account = db.getAccountById(id);
  if (!account) return c.json({ success: false, message: '账号不存在', code: 404 }, 404);
  const newStatus = !account.isActive;
  db.updateAccount(id, { isActive: newStatus });
  return c.json({ success: true, data: { isActive: newStatus }, code: 200 });
});

app.post('/api/accounts/:id/validate', async (c) => {
  const id = parseInt(c.req.param('id'));
  const account = db.getAccountById(id);
  if (!account) return c.json({ success: false, valid: false, message: '账号不存在', code: 404 }, 404);
  const valid = account.token && account.token.length > 10;
  db.updateAccount(id, { isValid: valid });
  return c.json({ success: true, data: { valid, message: valid ? '账号有效' : 'Token 无效' }, code: 200 });
});

app.post('/api/accounts/validate-all', async (c) => {
  const accounts = db.getAllAccounts();
  const results = [];
  let valid = 0, invalid = 0;
  for (const account of accounts) {
    const isValid = account.token && account.token.length > 10;
    db.updateAccount(account.id, { isValid });
    results.push({ id: account.id, userId: account.userId, valid: isValid, message: isValid ? '有效' : '无效' });
    isValid ? valid++ : invalid++;
  }
  return c.json({ success: true, data: { total: accounts.length, valid, invalid, results }, code: 200 });
});

app.get('/api/accounts/export/data', (c) => {
  const data = db.getAllAccounts().map(a => ({
    userId: a.userId, roleId: a.roleId, token: a.token,
    devCode: a.devCode, isWeb: a.isWeb, nickname: a.nickname, serverId: a.serverId,
  }));
  return c.json(data);
});

app.post('/api/accounts/import', async (c) => {
  const body = await c.req.json();
  let successCount = 0;
  for (const item of body) {
    if (item.userId && item.roleId && item.token) {
      db.createAccount({
        userId: item.userId, roleId: item.roleId, token: item.token,
        devCode: item.devCode || '', isWeb: item.isWeb ?? false,
        nickname: item.nickname || null, serverId: item.serverId || '76402e5b20be2c79f95d4f4ad1e41172',
        isActive: true, isValid: true, lastSignTime: null,
      });
      successCount++;
    }
  }
  return c.json({ success: successCount > 0, data: { total: body.length, successCount, failedCount: body.length - successCount, errors: [] }, code: 200 });
});

// 签到 API
app.post('/api/sign/all', async (c) => {
  const accounts = db.getActiveAccounts();
  const results = [];
  let success = 0, failed = 0, alreadySigned = 0;
  const today = new Date().toISOString().split('T')[0];

  for (const account of accounts) {
    if (db.hasSignedToday(account.id)) {
      results.push({ accountId: account.id, userId: account.userId, status: 'already_signed', message: '今日已签到', signDate: today });
      alreadySigned++;
      continue;
    }
    // 模拟签到
    const result = { accountId: account.id, userId: account.userId, nickname: account.nickname, status: 'success', message: '签到成功', reward: '星声 x20', signDate: today };
    db.createSignRecord({ accountId: account.id, signDate: today, status: 'success', reward: '星声 x20', message: '签到成功' });
    db.updateAccount(account.id, { lastSignTime: new Date().toISOString() });
    results.push(result);
    success++;
  }

  return c.json({ success: true, data: { total: accounts.length, success, failed, alreadySigned, skipped: 0, results }, code: 200 });
});

app.post('/api/sign/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const account = db.getAccountById(id);
  if (!account) return c.json({ success: false, message: '账号不存在', code: 404 }, 404);

  const today = new Date().toISOString().split('T')[0];
  if (db.hasSignedToday(id)) {
    return c.json({ success: true, data: { accountId: id, userId: account.userId, status: 'already_signed', message: '今日已签到', reward: null, signDate: today }, code: 200 });
  }

  const result = { accountId: id, userId: account.userId, nickname: account.nickname, status: 'success', message: '签到成功', reward: '星声 x20', signDate: today };
  db.createSignRecord({ accountId: id, signDate: today, status: 'success', reward: '星声 x20', message: '签到成功' });
  db.updateAccount(id, { lastSignTime: new Date().toISOString() });

  return c.json({ success: true, data: result, code: 200 });
});

// 认证中间件
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, message: '未登录', code: 401 }, 401);
  }
  const token = authHeader.substring(7);
  if (token !== ADMIN_PASSWORD) {
    return c.json({ success: false, message: '认证失败', code: 401 }, 401);
  }
  await next();
};

// 登录 API
app.post('/api/auth/login', async (c) => {
  const body = await c.req.json();
  if (body.password === ADMIN_PASSWORD) {
    return c.json({ success: true, token: ADMIN_PASSWORD, code: 200 });
  }
  return c.json({ success: false, message: '密码错误', code: 401 }, 401);
});

// 检查登录状态
app.get('/api/auth/check', authMiddleware, (c) => {
  return c.json({ success: true, code: 200 });
});

// 需要认证的 API
app.use('/api/accounts/*', authMiddleware);
app.use('/api/sign/*', authMiddleware);
app.use('/api/dashboard', authMiddleware);

// 仪表盘 API
app.get('/api/dashboard', (c) => {
  const accountStats = db.getAccountStats();
  const todayStats = db.getTodayStats();
  const recentLogs = db.getRecentLogs(10);
  const recentSignRecords = db.getRecentSignRecords(10);

  return c.json({
    success: true,
    data: {
      totalAccounts: accountStats.total,
      activeAccounts: accountStats.active,
      validAccounts: accountStats.valid,
      todaySigned: todayStats.signed,
      todayFailed: todayStats.failed,
      todayPending: todayStats.pending,
      recentLogs,
      recentSignRecords,
    },
    code: 200,
  });
});

// Deno Deploy 入口
const port = parseInt(Deno.env.get('PORT') || '8000');
Deno.serve({ port }, app.fetch);

console.log(`🚀 鸣潮签到管理系统 (Deno Deploy 版) 已启动！端口: ${port}`);
