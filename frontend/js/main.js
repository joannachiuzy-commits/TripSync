/**
 * 主入口文件
 * 初始化应用、处理标签页切换
 */

/**
 * 激活指定标签页
 * @param {string} tabName 标签名称（如 'collection', 'generate', 'edit', 'share'）
 */
function activateTab(tabName) {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // 移除所有活动状态
  tabButtons.forEach(b => b.classList.remove('active'));
  tabContents.forEach(c => c.classList.remove('active'));

  // 激活对应的按钮和内容
  tabButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    }
  });

  const targetContent = document.getElementById(`${tabName}Tab`);
  if (targetContent) {
    targetContent.classList.add('active');
  }

  // 如果激活的是生成行程标签，初始化行程生成模块
  if (tabName === 'generate' && window.tripGenerateModule) {
    window.tripGenerateModule.initTripGenerate();
  }
}

/**
 * 初始化标签页切换
 */
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const ACTIVE_TAB_KEY = 'activeTabId';

  // 页面加载时恢复标签页状态
  // 优先读取URL Hash，无则读本地存储，再无则默认收藏夹
  const hashTab = window.location.hash.slice(1);
  const savedTab = localStorage.getItem(ACTIVE_TAB_KEY);
  const defaultTab = 'collection';
  
  let activeTab = hashTab || savedTab || defaultTab;
  
  // 验证标签是否存在，不存在则使用默认值
  const validTabs = ['collection', 'generate', 'edit', 'share'];
  if (!validTabs.includes(activeTab)) {
    activeTab = defaultTab;
  }

  // 恢复激活的标签页
  activateTab(activeTab);

  // 绑定标签点击事件
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      
      // 激活标签页
      activateTab(targetTab);

      // 持久化状态：写入URL Hash和本地存储
      window.location.hash = targetTab;
      localStorage.setItem(ACTIVE_TAB_KEY, targetTab);
    });
  });

  // 监听URL Hash变化（支持浏览器前进后退）
  window.addEventListener('hashchange', () => {
    const hashTab = window.location.hash.slice(1);
    if (hashTab && validTabs.includes(hashTab)) {
      activateTab(hashTab);
      localStorage.setItem(ACTIVE_TAB_KEY, hashTab);
    }
  });
}

/**
 * 初始化应用
 */
async function initApp() {
  // 初始化用户模块
  if (window.userModule) {
    window.userModule.initUser();
  }

  // 初始化标签页
  initTabs();

  // 初始化高德地图配置（异步加载，不阻塞其他功能）
  if (window.amapConfigModule) {
    window.amapConfigModule.initAMapConfig().catch(err => {
      console.warn('高德配置初始化失败，地图相关功能可能不可用:', err);
    });
  }

  // 初始化各个模块
  if (window.collectionModule) {
    window.collectionModule.initCollection();
  }

  // tripGenerate 模块的初始化由标签页切换逻辑控制
  // 如果当前激活的是生成行程标签，会在 initTabs() 中自动初始化
  // 这里不再无条件初始化，避免在非生成行程标签时也初始化

  if (window.tripEditModule) {
    window.tripEditModule.initTripEdit();
  }

  if (window.shareModule) {
    window.shareModule.initShare();
  }

  console.log('TripSync 应用已初始化');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp);

