/**
 * 主入口文件
 * 初始化应用、处理标签页切换
 */

/**
 * 初始化标签页切换
 */
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      // 移除所有活动状态
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // 激活当前标签
      btn.classList.add('active');
      const targetContent = document.getElementById(`${targetTab}Tab`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
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

  if (window.tripGenerateModule) {
    window.tripGenerateModule.initTripGenerate();
  }

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

