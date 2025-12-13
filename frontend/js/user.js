/**
 * 用户模块
 * 处理用户登录、注册、退出
 */

// 用户信息存储键
const USER_STORAGE_KEY = 'tripsync_user';

/**
 * 获取当前用户信息
 */
function getCurrentUser() {
  const userStr = localStorage.getItem(USER_STORAGE_KEY);
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * 保存用户信息
 */
function saveUser(user) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

/**
 * 清除用户信息
 */
function clearUser() {
  localStorage.removeItem(USER_STORAGE_KEY);
}

/**
 * 显示登录页面
 */
function showLoginPage() {
  document.getElementById('loginPage').classList.add('active');
  document.getElementById('appPage').classList.remove('active');
}

/**
 * 显示主应用页面
 */
function showAppPage() {
  document.getElementById('loginPage').classList.remove('active');
  document.getElementById('appPage').classList.add('active');
  
  // 更新用户信息显示
  const user = getCurrentUser();
  if (user) {
    document.getElementById('userNickname').textContent = user.nickname;
  }
}

/**
 * 初始化用户模块
 */
function initUser() {
  // 检查登录状态
  const user = getCurrentUser();
  if (user) {
    showAppPage();
  } else {
    showLoginPage();
  }

  // 登录按钮
  document.getElementById('loginBtn').addEventListener('click', async () => {
    const nickname = document.getElementById('loginNickname').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!nickname || !password) {
      window.api.showToast('请输入昵称和密码', 'error');
      return;
    }

    try {
      const data = await window.api.post('/user/login', { nickname, password });
      saveUser(data);
      showAppPage();
      window.api.showToast('登录成功', 'success');
    } catch (error) {
      // 错误已在 api.js 中处理
    }
  });

  // 注册按钮
  document.getElementById('registerBtn').addEventListener('click', async () => {
    const nickname = document.getElementById('loginNickname').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!nickname || !password) {
      window.api.showToast('请输入昵称和密码', 'error');
      return;
    }

    try {
      const data = await window.api.post('/user/register', { nickname, password });
      window.api.showToast('注册成功，请登录', 'success');
      // 清空密码输入框
      document.getElementById('loginPassword').value = '';
    } catch (error) {
      // 错误已在 api.js 中处理
    }
  });

  // 退出按钮
  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearUser();
    showLoginPage();
    window.api.showToast('已退出登录', 'success');
  });
}

// 导出用户相关函数
window.userModule = {
  getCurrentUser,
  saveUser,
  clearUser,
  showLoginPage,
  showAppPage,
  initUser
};

