/**
 * API 请求封装
 * 统一处理接口调用、错误处理、加载状态
 */

const API_BASE = 'http://localhost:3006/api';

/**
 * 通用请求方法
 * @param {string} url 接口路径
 * @param {Object} options 请求选项
 * @returns {Promise<Object>}
 */
async function request(url, options = {}) {
  const {
    method = 'GET',
    body,
    showLoading = true,
    showError = true
  } = options;

  // 显示加载状态
  if (showLoading) {
    showLoadingOverlay();
  }

  try {
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    // 构建完整 URL
    let fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
    
    // GET 请求将 body 转为 query 参数
    if (method === 'GET' && body) {
      const params = new URLSearchParams(body).toString();
      fullUrl = params ? `${fullUrl}?${params}` : fullUrl;
      // GET 请求不需要 body
      delete config.body;
    }

    const response = await fetch(fullUrl, config);
    const data = await response.json();
    
    if (showLoading) hideLoadingOverlay();
    
    if (data.code === 0) {
      return data.data;
    } else {
      if (showError) showToast(data.msg || '请求失败', 'error');
      throw new Error(data.msg || '请求失败');
    }
  } catch (error) {
    if (showLoading) hideLoadingOverlay();
    
    if (showError) {
      showToast(error.message || '网络请求失败', 'error');
    }
    throw error;
  }
}

/**
 * GET 请求
 */
function get(url, params = {}, options = {}) {
  return request(url, { method: 'GET', body: params, ...options });
}

/**
 * POST 请求
 */
function post(url, body = {}, options = {}) {
  return request(url, { method: 'POST', body, ...options });
}

/**
 * 显示加载遮罩
 */
function showLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
  }
}

/**
 * 隐藏加载遮罩
 */
function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

/**
 * 显示提示消息
 * @param {string} message 消息内容
 * @param {string} type 消息类型：success | error
 */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast show ${type}`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// 导出 API 方法
window.api = {
  request,
  get,
  post,
  showLoadingOverlay,
  hideLoadingOverlay,
  showToast
};

