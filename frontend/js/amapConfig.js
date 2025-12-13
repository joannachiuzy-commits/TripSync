/**
 * 高德地图配置模块
 * 动态获取高德配置并初始化
 * 
 * 注意：禁止在前端代码硬编码密钥，所有密钥通过后端接口获取
 */

let amapConfigLoaded = false;
let amapConfigPromise = null;

/**
 * 初始化高德地图配置
 * 从后端获取配置并设置安全密钥，动态加载高德 JS API
 * @returns {Promise<void>}
 */
async function initAMapConfig() {
  // 如果已经加载过，直接返回
  if (amapConfigLoaded) {
    return Promise.resolve();
  }

  // 如果正在加载，返回同一个 Promise
  if (amapConfigPromise) {
    return amapConfigPromise;
  }

  amapConfigPromise = (async () => {
    try {
      const response = await fetch('/api/config/amap');
      const data = await response.json();

      if (data.code !== 0) {
        throw new Error(data.msg || '获取高德配置失败');
      }

      const config = data.data;

      if (!config.key) {
        throw new Error('高德配置未完成：请在服务器 .env 文件中配置 AMAP_KEY');
      }

      // 动态配置安全密钥（仅在高德 API 加载前执行）
      if (config.securityJsCode) {
        window._AMapSecurityConfig = {
          securityJsCode: config.securityJsCode
        };
      }

      // 动态加载高德 JS API
      return new Promise((resolve, reject) => {
        // 检查是否已加载
        if (window.AMap) {
          amapConfigLoaded = true;
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = `https://webapi.amap.com/maps?v=2.0&key=${config.key}`;
        script.type = 'text/javascript';
        script.async = true;

        script.onload = () => {
          amapConfigLoaded = true;
          console.log('高德地图 API 加载成功');
          resolve();
        };

        script.onerror = () => {
          const error = new Error('高德地图 API 加载失败');
          console.error('高德地图 API 加载失败');
          reject(error);
        };

        document.head.appendChild(script);
      });
    } catch (error) {
      console.error('高德配置初始化失败：', error);
      // 显示友好提示
      if (window.api && window.api.showToast) {
        window.api.showToast('高德地图配置未完成，路线规划功能暂不可用', 'error');
      } else {
        console.warn('高德地图配置未完成，路线规划功能暂不可用');
      }
      throw error;
    }
  })();

  return amapConfigPromise;
}

/**
 * 等待高德配置加载完成
 * 所有高德相关操作均应等待此函数完成后再执行
 * @returns {Promise<void>}
 */
async function waitForAMapConfig() {
  try {
    await initAMapConfig();
  } catch (error) {
    // 配置加载失败时不阻止其他功能，只记录错误
    console.warn('高德配置加载失败，相关功能可能不可用:', error);
  }
}

/**
 * 检查高德配置是否已加载
 * @returns {boolean}
 */
function isAMapConfigLoaded() {
  return amapConfigLoaded && !!window.AMap;
}

// 导出配置相关函数
window.amapConfigModule = {
  initAMapConfig,
  waitForAMapConfig,
  isAMapConfigLoaded
};

