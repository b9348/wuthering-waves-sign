import { Hono } from 'hono';
import { html } from 'hono/html';

export function createPageRouter() {
  const app = new Hono();

  // 主页 - 仪表盘
  app.get('/', (c) => {
    return c.html(html`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>鸣潮签到管理系统</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    [x-cloak] { display: none !important; }
    .fade-in { animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  </style>
</head>
<body class="bg-gray-100 min-h-screen" x-data="app()" x-init="init()">
  <!-- 导航栏 -->
  <nav class="bg-blue-600 text-white shadow-lg">
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
          <div class="bg-blue-100 p-3 rounded-full">
            <i class="fas fa-users text-blue-600"></i>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-500 text-sm">有效账号</p>
            <p class="text-2xl font-bold text-green-600" x-text="stats.validAccounts">0</p>
          </div>
          <div class="bg-green-100 p-3 rounded-full">
            <i class="fas fa-check-circle text-green-600"></i>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-500 text-sm">今日已签到</p>
            <p class="text-2xl font-bold text-purple-600" x-text="stats.todaySigned">0</p>
          </div>
          <div class="bg-purple-100 p-3 rounded-full">
            <i class="fas fa-calendar-check text-purple-600"></i>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-500 text-sm">待签到</p>
            <p class="text-2xl font-bold text-orange-600" x-text="stats.todayPending">0</p>
          </div>
          <div class="bg-orange-100 p-3 rounded-full">
            <i class="fas fa-clock text-orange-600"></i>
          </div>
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
          <i class="fas fa-download mr-2"></i>导出账号
        </button>
        <label class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition cursor-pointer">
          <i class="fas fa-upload mr-2"></i>导入账号
          <input type="file" @change="importAccounts($event)" accept=".json" class="hidden">
        </label>
        <button @click="showSettingsModal = true" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded transition">
          <i class="fas fa-cog mr-2"></i>设置
        </button>
      </div>
    </div>

    <!-- 账号列表 -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <h2 class="text-lg font-semibold">账号列表</h2>
        <div class="flex items-center space-x-2">
          <input x-model="searchQuery" type="text" placeholder="搜索账号..." class="border rounded px-3 py-1 text-sm">
          <select x-model="filterStatus" class="border rounded px-3 py-1 text-sm">
            <option value="all">全部状态</option>
            <option value="active">已启用</option>
            <option value="inactive">已禁用</option>
            <option value="valid">有效</option>
            <option value="invalid">无效</option>
          </select>
        </div>
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
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">有效性</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">最后签到</th>
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
                  <span :class="account.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'" 
                        class="px-2 py-1 text-xs rounded-full" 
                        x-text="account.isActive ? '启用' : '禁用'"></span>
                </td>
                <td class="px-4 py-3">
                  <span :class="account.isValid ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'" 
                        class="px-2 py-1 text-xs rounded-full" 
                        x-text="account.isValid ? '有效' : '无效'"></span>
                </td>
                <td class="px-4 py-3 text-sm" x-text="account.lastSignTime ? new Date(account.lastSignTime).toLocaleString() : '从未'"></td>
                <td class="px-4 py-3">
                  <div class="flex space-x-2">
                    <button @click="signAccount(account.id)" :disabled="signing" class="text-green-600 hover:text-green-800" title="签到">
                      <i class="fas fa-play"></i>
                    </button>
                    <button @click="validateAccount(account.id)" :disabled="validating" class="text-blue-600 hover:text-blue-800" title="验证">
                      <i class="fas fa-check"></i>
                    </button>
                    <button @click="editAccount(account)" class="text-yellow-600 hover:text-yellow-800" title="编辑">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button @click="toggleAccount(account.id)" class="text-purple-600 hover:text-purple-800" title="启用/禁用">
                      <i class="fas" :class="account.isActive ? 'fa-pause' : 'fa-play'"></i>
                    </button>
                    <button @click="deleteAccount(account.id)" class="text-red-600 hover:text-red-800" title="删除">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      
      <div x-show="filteredAccounts.length === 0" class="text-center py-8 text-gray-500">
        暂无账号数据
      </div>
    </div>

    <!-- 最近日志 -->
    <div class="bg-white rounded-lg shadow mt-6">
      <div class="px-4 py-3 border-b border-gray-200">
        <h2 class="text-lg font-semibold">最近日志</h2>
      </div>
      <div class="p-4">
        <div class="space-y-2 max-h-60 overflow-y-auto">
          <template x-for="log in recentLogs" :key="log.id">
            <div :class="{
              'bg-green-50 border-green-200': log.type === 'success',
              'bg-red-50 border-red-200': log.type === 'error',
              'bg-yellow-50 border-yellow-200': log.type === 'warning',
              'bg-blue-50 border-blue-200': log.type === 'info'
            }" class="border rounded p-2 text-sm">
              <div class="flex justify-between">
                <span :class="{
                  'text-green-700': log.type === 'success',
                  'text-red-700': log.type === 'error',
                  'text-yellow-700': log.type === 'warning',
                  'text-blue-700': log.type === 'info'
                }" class="font-medium" x-text="log.message"></span>
                <span class="text-gray-400 text-xs" x-text="new Date(log.createdAt).toLocaleString()"></span>
              </div>
              <div x-show="log.details" x-text="log.details" class="text-gray-600 mt-1"></div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- 添加账号模态框 -->
  <div x-show="showAddModal" x-cloak class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold">添加账号</h3>
      </div>
      <div class="px-6 py-4 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">用户ID</label>
          <input x-model="newAccount.userId" type="text" class="w-full border rounded px-3 py-2" placeholder="请输入用户ID">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">角色ID</label>
          <input x-model="newAccount.roleId" type="text" class="w-full border rounded px-3 py-2" placeholder="请输入角色ID">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Token</label>
          <input x-model="newAccount.token" type="text" class="w-full border rounded px-3 py-2" placeholder="请输入Token">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">设备码 (可选)</label>
          <input x-model="newAccount.devCode" type="text" class="w-full border rounded px-3 py-2" placeholder="请输入设备码">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">昵称 (可选)</label>
          <input x-model="newAccount.nickname" type="text" class="w-full border rounded px-3 py-2" placeholder="请输入昵称">
        </div>
        <div class="flex items-center">
          <input x-model="newAccount.isWeb" type="checkbox" id="isWeb" class="mr-2">
          <label for="isWeb" class="text-sm text-gray-700">Web端账号</label>
        </div>
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
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold">编辑账号</h3>
      </div>
      <div class="px-6 py-4 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">用户ID</label>
          <input x-model="editAccountData.userId" type="text" class="w-full border rounded px-3 py-2">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">角色ID</label>
          <input x-model="editAccountData.roleId" type="text" class="w-full border rounded px-3 py-2">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Token</label>
          <input x-model="editAccountData.token" type="text" class="w-full border rounded px-3 py-2">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">设备码</label>
          <input x-model="editAccountData.devCode" type="text" class="w-full border rounded px-3 py-2">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">昵称</label>
          <input x-model="editAccountData.nickname" type="text" class="w-full border rounded px-3 py-2">
        </div>
      </div>
      <div class="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
        <button @click="showEditModal = false" class="px-4 py-2 text-gray-600 hover:text-gray-800">取消</button>
        <button @click="updateAccount()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">保存</button>
      </div>
    </div>
  </div>

  <!-- 设置模态框 -->
  <div x-show="showSettingsModal" x-cloak class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold">系统设置</h3>
      </div>
      <div class="px-6 py-4 space-y-4">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-gray-700">自动签到</label>
          <input x-model="settings.autoSign" type="checkbox" class="w-5 h-5">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">签到时间</label>
          <input x-model="settings.signTime" type="time" class="w-full border rounded px-3 py-2">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">通知方式</label>
          <select x-model="settings.notifyType" class="w-full border rounded px-3 py-2">
            <option value="none">不通知</option>
            <option value="webhook">Webhook</option>
          </select>
        </div>
        <div x-show="settings.notifyType === 'webhook'">
          <label class="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
          <input x-model="settings.notifyWebhook" type="text" class="w-full border rounded px-3 py-2" placeholder="https://...">
        </div>
      </div>
      <div class="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
        <button @click="showSettingsModal = false" class="px-4 py-2 text-gray-600 hover:text-gray-800">取消</button>
        <button @click="saveSettings()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">保存</button>
      </div>
    </div>
  </div>

  <!-- 提示消息 -->
  <div x-show="toast.show" x-transition class="fixed bottom-4 right-4 px-6 py-3 rounded shadow-lg z-50"
       :class="{
         'bg-green-500 text-white': toast.type === 'success',
         'bg-red-500 text-white': toast.type === 'error',
         'bg-yellow-500 text-white': toast.type === 'warning'
       }">
    <span x-text="toast.message"></span>
  </div>

  <script>
    function app() {
      return {
        loading: false,
        signing: false,
        validating: false,
        accounts: [],
        stats: {
          totalAccounts: 0,
          activeAccounts: 0,
          validAccounts: 0,
          todaySigned: 0,
          todayFailed: 0,
          todayPending: 0
        },
        recentLogs: [],
        searchQuery: '',
        filterStatus: 'all',
        showAddModal: false,
        showEditModal: false,
        showSettingsModal: false,
        newAccount: { userId: '', roleId: '', token: '', devCode: '', nickname: '', isWeb: false },
        editAccountData: { id: null, userId: '', roleId: '', token: '', devCode: '', nickname: '' },
        settings: { autoSign: false, signTime: '09:00', notifyType: 'none', notifyWebhook: '' },
        toast: { show: false, message: '', type: 'success' },

        get filteredAccounts() {
          return this.accounts.filter(account => {
            const matchesSearch = !this.searchQuery || 
              account.userId.includes(this.searchQuery) || 
              account.roleId.includes(this.searchQuery) ||
              (account.nickname && account.nickname.includes(this.searchQuery));
            
            const matchesFilter = this.filterStatus === 'all' ||
              (this.filterStatus === 'active' && account.isActive) ||
              (this.filterStatus === 'inactive' && !account.isActive) ||
              (this.filterStatus === 'valid' && account.isValid) ||
              (this.filterStatus === 'invalid' && !account.isValid);
            
            return matchesSearch && matchesFilter;
          });
        },

        async init() {
          await this.refreshData();
          await this.loadSettings();
        },

        async refreshData() {
          this.loading = true;
          try {
            const [accountsRes, dashboardRes] = await Promise.all([
              fetch('/api/accounts'),
              fetch('/api/dashboard')
            ]);
            
            const accountsData = await accountsRes.json();
            const dashboardData = await dashboardRes.json();
            
            if (accountsData.success) this.accounts = accountsData.data;
            if (dashboardData.success) {
              this.stats = dashboardData.data;
              this.recentLogs = dashboardData.data.recentLogs;
            }
          } catch (error) {
            this.showToast('加载数据失败', 'error');
          }
          this.loading = false;
        },

        async loadSettings() {
          try {
            const res = await fetch('/api/settings/config');
            const data = await res.json();
            if (data.success) this.settings = data.data;
          } catch (error) {
            console.error('加载设置失败', error);
          }
        },

        async addAccount() {
          try {
            const res = await fetch('/api/accounts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(this.newAccount)
            });
            const data = await res.json();
            if (data.success) {
              this.showToast('添加账号成功', 'success');
              this.showAddModal = false;
              this.newAccount = { userId: '', roleId: '', token: '', devCode: '', nickname: '', isWeb: false };
              await this.refreshData();
            } else {
              this.showToast(data.message || '添加失败', 'error');
            }
          } catch (error) {
            this.showToast('添加账号失败', 'error');
          }
        },

        editAccount(account) {
          this.editAccountData = { ...account };
          this.showEditModal = true;
        },

        async updateAccount() {
          try {
            const res = await fetch(\`/api/accounts/\${this.editAccountData.id}\`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(this.editAccountData)
            });
            const data = await res.json();
            if (data.success) {
              this.showToast('更新账号成功', 'success');
              this.showEditModal = false;
              await this.refreshData();
            } else {
              this.showToast(data.message || '更新失败', 'error');
            }
          } catch (error) {
            this.showToast('更新账号失败', 'error');
          }
        },

        async deleteAccount(id) {
          if (!confirm('确定要删除这个账号吗？')) return;
          try {
            const res = await fetch(\`/api/accounts/\${id}\`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
              this.showToast('删除账号成功', 'success');
              await this.refreshData();
            } else {
              this.showToast(data.message || '删除失败', 'error');
            }
          } catch (error) {
            this.showToast('删除账号失败', 'error');
          }
        },

        async toggleAccount(id) {
          try {
            const res = await fetch(\`/api/accounts/\${id}/toggle\`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
              this.showToast(data.data.isActive ? '账号已启用' : '账号已禁用', 'success');
              await this.refreshData();
            }
          } catch (error) {
            this.showToast('操作失败', 'error');
          }
        },

        async signAccount(id) {
          this.signing = true;
          try {
            const res = await fetch(\`/api/sign/\${id}\`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
              this.showToast(\`签到结果: \${data.data.message}\`, data.data.status === 'success' ? 'success' : 'warning');
              await this.refreshData();
            } else {
              this.showToast(data.message || '签到失败', 'error');
            }
          } catch (error) {
            this.showToast('签到失败', 'error');
          }
          this.signing = false;
        },

        async signAll() {
          this.signing = true;
          try {
            const res = await fetch('/api/sign/all', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
              this.showToast(\`签到完成: 成功 \${data.data.success}, 失败 \${data.data.failed}\`, 'success');
              await this.refreshData();
            } else {
              this.showToast(data.message || '签到失败', 'error');
            }
          } catch (error) {
            this.showToast('签到失败', 'error');
          }
          this.signing = false;
        },

        async validateAccount(id) {
          this.validating = true;
          try {
            const res = await fetch(\`/api/accounts/\${id}/validate\`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
              this.showToast(\`验证结果: \${data.data.message}\`, data.data.valid ? 'success' : 'error');
              await this.refreshData();
            } else {
              this.showToast(data.message || '验证失败', 'error');
            }
          } catch (error) {
            this.showToast('验证失败', 'error');
          }
          this.validating = false;
        },

        async validateAll() {
          this.validating = true;
          try {
            const res = await fetch('/api/accounts/validate-all', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
              this.showToast(\`验证完成: 有效 \${data.data.valid}, 无效 \${data.data.invalid}\`, 'success');
              await this.refreshData();
            } else {
              this.showToast(data.message || '验证失败', 'error');
            }
          } catch (error) {
            this.showToast('验证失败', 'error');
          }
          this.validating = false;
        },

        async exportAccounts() {
          try {
            const res = await fetch('/api/accounts/export/data');
            const data = await res.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = \`accounts_\${new Date().toISOString().split('T')[0]}.json\`;
            a.click();
            URL.revokeObjectURL(url);
            this.showToast('导出成功', 'success');
          } catch (error) {
            this.showToast('导出失败', 'error');
          }
        },

        async importAccounts(event) {
          const file = event.target.files[0];
          if (!file) return;
          
          try {
            const text = await file.text();
            const accounts = JSON.parse(text);
            const res = await fetch('/api/accounts/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(accounts)
            });
            const data = await res.json();
            if (data.success) {
              this.showToast(\`导入成功: \${data.data.successCount} 个账号\`, 'success');
              await this.refreshData();
            } else {
              this.showToast(data.message || '导入失败', 'error');
            }
          } catch (error) {
            this.showToast('导入失败: 文件格式错误', 'error');
          }
          event.target.value = '';
        },

        async saveSettings() {
          try {
            const res = await fetch('/api/settings/config', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(this.settings)
            });
            const data = await res.json();
            if (data.success) {
              this.showToast('设置保存成功', 'success');
              this.showSettingsModal = false;
            } else {
              this.showToast(data.message || '保存失败', 'error');
            }
          } catch (error) {
            this.showToast('保存设置失败', 'error');
          }
        },

        showToast(message, type = 'success') {
          this.toast = { show: true, message, type };
          setTimeout(() => this.toast.show = false, 3000);
        }
      }
    }
  </script>
</body>
</html>`);
  });

  return app;
}
