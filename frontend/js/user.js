/**
 * 用户模块
 * 处理用户登录、注册、退出
 */

// 用户信息存储键
const USER_STORAGE_KEY = 'tripsync_user';
const GUEST_ID_KEY = 'tripSync_guestId';

/**
 * 获取当前用户信息（支持正式用户和游客）
 */
function getCurrentUser() {
  // 优先获取正式用户信息
  const userStr = localStorage.getItem(USER_STORAGE_KEY);
  if (userStr) {
    return JSON.parse(userStr);
  }
  
  // 如果没有正式用户，检查是否有游客ID
  const guestId = localStorage.getItem(GUEST_ID_KEY);
  if (guestId) {
    return {
      userId: guestId,
      nickname: '游客',
      userType: 'guest'
    };
  }
  
  return null;
}

/**
 * 保存用户信息
 */
function saveUser(user) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

/**
 * 清除用户信息（包括游客信息）
 */
function clearUser() {
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(GUEST_ID_KEY);
}

/**
 * 显示登录页面
 */
function showLoginPage() {
  try {
    const loginPage = document.getElementById('loginPage');
    const appPage = document.getElementById('appPage');
    
    if (!loginPage || !appPage) {
      console.error('页面元素未找到：loginPage或appPage不存在');
      return;
    }
    
    // 显示登录视图，隐藏主应用视图
    loginPage.style.display = 'flex'; // 使用flex以保持居中布局
    appPage.style.display = 'none';
    
    console.log('页面切换：显示登录视图，隐藏主应用视图');
  } catch (error) {
    console.error('显示登录页面失败:', error);
  }
}

/**
 * 重新初始化所有功能模块
 * 用于登录/注册/游客进入后确保功能模块正常工作
 */
function reinitializeModules() {
  try {
    console.log('开始重新初始化功能模块');
    
    // 初始化标签页切换（如果尚未初始化）
    if (typeof initTabs === 'function') {
      initTabs();
    }
    
    // 初始化高德地图配置（异步加载，不阻塞其他功能）
    if (window.amapConfigModule && window.amapConfigModule.initAMapConfig) {
      window.amapConfigModule.initAMapConfig().catch(err => {
        console.warn('高德配置初始化失败:', err);
      });
    }
    
    // 初始化收藏模块
    if (window.collectionModule && window.collectionModule.initCollection) {
      window.collectionModule.initCollection();
    }
    
    // 初始化行程生成模块
    if (window.tripGenerateModule && window.tripGenerateModule.initTripGenerate) {
      window.tripGenerateModule.initTripGenerate();
    }
    
    // 初始化行程编辑模块
    if (window.tripEditModule && window.tripEditModule.initTripEdit) {
      window.tripEditModule.initTripEdit();
    }
    
    // 初始化分享模块
    if (window.shareModule && window.shareModule.initShare) {
      window.shareModule.initShare();
    }
    
    console.log('功能模块重新初始化完成');
  } catch (error) {
    console.error('重新初始化功能模块失败:', error);
  }
}

/**
 * 显示主应用页面
 */
function showAppPage() {
  try {
    const loginPage = document.getElementById('loginPage');
    const appPage = document.getElementById('appPage');
    
    if (!loginPage || !appPage) {
      console.error('页面元素未找到：loginPage或appPage不存在');
      return;
    }
    
    // 隐藏登录视图，显示主应用视图（使用display切换，确保全屏显示）
    loginPage.style.display = 'none';
    appPage.style.display = 'block';
    
    console.log('页面切换：登录视图隐藏，主应用视图显示（全屏）');
    
    // 更新用户信息显示
    const user = getCurrentUser();
    if (user) {
      const nicknameEl = document.getElementById('userNickname');
      if (nicknameEl) {
        if (user.userType === 'guest') {
          nicknameEl.textContent = '游客模式';
          nicknameEl.style.color = '#4a90e2';
        } else {
          nicknameEl.textContent = user.nickname;
          nicknameEl.style.color = '';
        }
        console.log('用户信息显示已更新:', user.userType === 'guest' ? '游客模式' : user.nickname);
      } else {
        console.warn('用户昵称显示元素未找到：userNickname');
      }
    } else {
      console.warn('未获取到用户信息');
    }
  } catch (error) {
    console.error('显示主应用页面失败:', error);
  }
}

/**
 * 初始化用户模块
 */
function initUser() {
  // 确保初始状态：登录视图显示，主应用视图隐藏
  const loginPage = document.getElementById('loginPage');
  const appPage = document.getElementById('appPage');
  
  if (loginPage && appPage) {
    // 检查登录状态（支持正式用户和游客）
    const user = getCurrentUser();
    if (user) {
      // 有用户信息，显示主应用视图
      showAppPage();
    } else {
      // 无用户信息，显示登录视图
      showLoginPage();
    }
  } else {
    console.error('页面元素未找到，无法初始化用户模块');
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
      
      // 重新初始化功能模块（确保登录后功能正常）
      reinitializeModules();
      
      window.api.showToast('登录成功', 'success');
    } catch (error) {
      // 错误已在 api.js 中处理
    }
  });

  // 注册按钮
  document.getElementById('registerBtn').addEventListener('click', async () => {
    const nickname = document.getElementById('loginNickname').value.trim();
    const password = document.getElementById('loginPassword').value;

    // 非空校验
    if (!nickname) {
      window.api.showToast('请输入昵称', 'error');
      return;
    }
    
    if (!password) {
      window.api.showToast('请输入密码', 'error');
      return;
    }

    // 密码长度校验
    if (password.length < 3) {
      window.api.showToast('密码长度至少为3位', 'error');
      return;
    }

    try {
      const data = await window.api.post('/user/register', { nickname, password });
      
      // 注册成功后自动登录
      if (data && data.userId) {
        // 保存用户信息（注册接口返回的数据）
        saveUser(data);
        showAppPage();
        
        // 重新初始化功能模块（确保注册登录后功能正常）
        reinitializeModules();
        
        window.api.showToast('注册成功，已自动登录', 'success');
        // 清空输入框
        document.getElementById('loginNickname').value = '';
        document.getElementById('loginPassword').value = '';
      } else {
        window.api.showToast('注册成功，请登录', 'success');
        // 清空密码输入框
        document.getElementById('loginPassword').value = '';
      }
    } catch (error) {
      // 错误已在 api.js 中处理，这里可以添加额外的错误处理
      console.error('注册失败:', error);
    }
  });

  // 游客进入按钮
  const guestBtn = document.getElementById('guestBtn');
  if (guestBtn) {
    guestBtn.addEventListener('click', () => {
      try {
        // 生成随机临时用户ID（格式：guest_时间戳_随机字符串）
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 10);
        const guestId = `guest_${timestamp}_${randomStr}`;
        
        console.log('游客进入：生成游客ID', guestId);
        
        // 清除正式用户信息（如果存在）
        // 注意：只删除USER_STORAGE_KEY，保留GUEST_ID_KEY用于后续检查
        localStorage.removeItem(USER_STORAGE_KEY);
        
        // 存储游客ID到专用键（用于getCurrentUser()的备用检查）
        localStorage.setItem(GUEST_ID_KEY, guestId);
        
        // 创建游客用户对象
        const guestUser = {
          userId: guestId,
          nickname: '游客',
          userType: 'guest'
        };
        
        // 保存到localStorage（用于统一接口，getCurrentUser()优先读取）
        saveUser(guestUser);
        
        console.log('游客进入：已保存用户信息', guestUser);
        
        // 切换到主页面
        showAppPage();
        
        // 关键修复：手动重新初始化所有核心功能模块
        // 原因：initApp()仅在页面初始加载时执行一次，游客登录切换页面后需要重新初始化模块
        reinitializeModules();
        
        // 显示成功提示
        if (window.api && window.api.showToast) {
          window.api.showToast('已进入游客模式', 'success');
        }
        
        console.log('游客进入：页面跳转完成');
      } catch (error) {
        console.error('游客进入失败:', error);
        if (window.api && window.api.showToast) {
          window.api.showToast('进入游客模式失败，请刷新页面重试', 'error');
        }
      }
    });
  } else {
    console.error('游客进入按钮未找到，请检查HTML中是否存在id="guestBtn"的按钮');
  }

  // 退出按钮
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      const user = getCurrentUser();
      // 清除所有用户信息（包括正式用户和游客）
      clearUser();
      // 跳转到登录页面
      showLoginPage();
      const msg = user && user.userType === 'guest' ? '已退出游客模式' : '已退出登录';
      if (window.api && window.api.showToast) {
        window.api.showToast(msg, 'success');
      }
    });
  }
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

