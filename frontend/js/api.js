/**
 * API 请求封装
 * 统一处理接口调用、错误处理、加载状态
 */

// API 基础地址配置
// 【重要】确保使用本地后端服务地址，不要使用公网 IP
// 默认使用 localhost:3006，与后端 app.js 中的 PORT 配置一致
// 可以通过在 HTML 中设置 window.API_BASE_URL 来覆盖默认值（仅用于特殊场景）
const API_BASE = window.API_BASE_URL || 'http://localhost:3006/api';

// 验证 API 地址是否为本地地址（开发环境安全检查）
if (API_BASE.includes('localhost') || API_BASE.includes('127.0.0.1')) {
  // 开发环境：在控制台显示当前使用的 API 地址（便于调试）
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('📍 API 基础地址:', API_BASE);
    console.log('✅ 已确认使用本地后端服务地址');
  }
} else {
  console.warn('⚠️  警告：API 地址不是本地地址，当前配置:', API_BASE);
  console.warn('   建议修改为本地地址，如: http://localhost:3006/api');
}

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

  // 创建 AbortController 用于超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

  // 构建完整 URL（在 try 块之前定义，确保 catch 块中可用）
  let fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  
  // GET 请求将 body 转为 query 参数（在 try 块之前处理，确保 fullUrl 完整）
  if (method === 'GET' && body) {
    const params = new URLSearchParams(body).toString();
    fullUrl = params ? `${fullUrl}?${params}` : fullUrl;
  }

  try {
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal // 添加超时控制
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    // 开发环境：记录请求 URL（便于调试）
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log(`📤 API 请求: ${method} ${fullUrl}`);
    }

    const response = await fetch(fullUrl, config);
    clearTimeout(timeoutId); // 请求成功，清除超时定时器
    
    // 1. 检查HTTP状态码（非200则抛错）
    if (!response.ok) {
      throw new Error(`HTTP错误：${response.status} ${response.statusText}`);
    }
    
    // 2. 尝试解析响应（处理非JSON响应）
    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      throw new Error(`响应解析失败：${parseError.message}`);
    }
    
    if (showLoading) hideLoadingOverlay();
    
    // 3. 检查后端返回的code（非0则抛错）
    if (responseData.code !== 0) {
      const errorMsg = responseData.msg || '请求失败';
      if (showError) showToast(errorMsg, 'error');
      throw new Error(errorMsg);
    }
    
    return responseData.data;
  } catch (error) {
    clearTimeout(timeoutId); // 确保清除超时定时器
    if (showLoading) hideLoadingOverlay();
    
    // 记录详细错误信息到控制台（便于调试）
    console.error('❌ API 请求失败:', {
      url: fullUrl || url,
      method: method,
      error: error.message,
      errorName: error.name,
      apiBase: API_BASE
    });
    
    // 4. 统一处理所有错误，返回明确的错误信息
    let errorMessage = '网络请求失败';
    
    if (error.name === 'AbortError') {
      // 前端请求超时（60秒）
      errorMessage = '请求超时，请检查网络连接或稍后重试';
    } else if (error.message && (error.message.includes('ETIMEDOUT') || error.message.includes('timeout'))) {
      // 连接超时：可能是后端服务未启动，或后端调用外部服务超时
      if (API_BASE.includes('localhost') || API_BASE.includes('127.0.0.1')) {
        errorMessage = '本地后端服务未启动，请先启动后端服务（npm start）';
      } else {
        errorMessage = '连接超时，服务暂时不可用，请检查网络或稍后重试';
      }
    } else if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
      // 无法连接到服务器：通常是后端服务未启动
      if (API_BASE.includes('localhost') || API_BASE.includes('127.0.0.1')) {
        errorMessage = '无法连接到本地后端服务，请检查后端服务是否已启动（npm start）';
      } else {
        errorMessage = '无法连接到服务器，请检查后端服务是否启动';
      }
    } else if (error.message && error.message.includes('AI生成失败')) {
      // 后端返回的 AI 生成失败错误，直接显示后端错误信息
      // 注意：这里的错误可能来自后端调用 OpenAI API 的超时
      if (error.message.includes('ETIMEDOUT')) {
        errorMessage = 'AI 生成超时，可能是网络问题或 OpenAI API 服务异常，请稍后重试';
      } else {
        errorMessage = error.message;
      }
    } else {
      // 包装错误，确保前端能拿到明确的错误信息
      errorMessage = error.message || '网络请求异常';
    }
    
    if (showError) {
      showToast(errorMessage, 'error');
    }
    // 确保抛出的错误包含明确的错误信息
    throw new Error(errorMessage);
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
 * POST 请求（返回完整响应，不抛错）
 * 用于需要处理业务提示（code!==0）的场景
 */
async function postRaw(url, body = {}, options = {}) {
  const { showLoading = true } = options;
  
  if (showLoading) {
    showLoadingOverlay();
  }
  
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  
  try {
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP错误：${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    if (showLoading) hideLoadingOverlay();
    
    // 返回完整响应（包括code、msg、data），由上层处理
    return responseData;
  } catch (error) {
    if (showLoading) hideLoadingOverlay();
    console.error(`POST ${url} 失败:`, error);
    throw new Error(error.message || '网络请求异常');
  }
}

/**
 * DELETE 请求
 */
function deleteRequest(url, body = {}, options = {}) {
  return request(url, { method: 'DELETE', body, ...options });
}

/**
 * 直接调用fetch（用于需要获取完整响应的情况）
 */
async function fetchRaw(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const config = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  if (options.body && config.method !== 'GET') {
    config.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const response = await fetch(fullUrl, config);
  return response.json();
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
 * @param {string} type 消息类型：success | error | warning
 */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // 兜底处理：若message为空，显示默认文本
  const safeMessage = message || '操作提示：无详细信息';
  
  toast.textContent = safeMessage;
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
  postRaw, // 新增：返回完整响应的POST请求
  delete: deleteRequest,
  fetchRaw,
  showLoadingOverlay,
  hideLoadingOverlay,
  showToast,
  API_BASE // 导出API_BASE供其他模块使用
};

