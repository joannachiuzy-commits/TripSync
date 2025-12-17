/**
 * OpenAI GPT API 工具
 * 封装 GPT 请求，用于生成行程
 */

const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// 支持两种格式：
// 1. 完整URL：https://api.openai.com/v1/chat/completions
// 2. 基础URL：https://api.openai.com/v1（会自动拼接 /chat/completions）
const OPENAI_API_BASE = process.env.OPENAI_API_URL || 'https://api.openai.com/v1';
const PROXY_URL = process.env.OPENAI_PROXY_URL; // 代理地址，格式：http://代理地址:端口
const DEFAULT_PROXY_URL = 'http://127.0.0.1:7890'; // Clash默认代理端口
const USE_PROXY = process.env.OPENAI_USE_PROXY !== 'false'; // 默认使用代理（除非明确设置为 false）

// 配置 axios 默认超时时间（60秒，适配代理请求）
// 使用代理时可能需要更长时间，但 60 秒通常足够
const AXIOS_TIMEOUT = 60000;

// 构建完整的 API URL
// 如果 OPENAI_API_BASE 已经包含 /chat/completions，直接使用；否则拼接
function getOpenAIApiUrl() {
  if (OPENAI_API_BASE.includes('/chat/completions')) {
    return OPENAI_API_BASE;
  }
  // 确保基础URL以 / 结尾，然后拼接 chat/completions
  const baseUrl = OPENAI_API_BASE.endsWith('/') ? OPENAI_API_BASE.slice(0, -1) : OPENAI_API_BASE;
  return `${baseUrl}/chat/completions`;
}

const OPENAI_API_URL = getOpenAIApiUrl();

// 启动时验证配置
function validateConfig() {
  if (!OPENAI_API_KEY) {
    console.warn('⚠️  [配置检查] OPENAI_API_KEY 未配置，AI 生成功能将不可用');
    console.warn('   请在 .env 文件中配置 OPENAI_API_KEY');
  } else {
    console.log('✅ [配置检查] OPENAI_API_KEY 已配置（长度:', OPENAI_API_KEY.length, '字符）');
  }

  console.log('📍 [配置检查] OpenAI API 地址:', OPENAI_API_URL);
  
  // 检查是否有无效的IP地址配置
  const invalidIPs = ['47.88.58.234', '31.13.91.6', '173.252.105.21', '118.193.240.37'];
  if (invalidIPs.some(ip => OPENAI_API_URL.includes(ip))) {
    console.error('❌ [配置检查] 检测到无效的 IP 地址配置:', OPENAI_API_URL);
    console.error('   请检查 .env 文件中的 OPENAI_API_URL 配置');
    console.error('   建议配置为: https://api.openai.com/v1 或可用的代理服务地址');
  }

  if (USE_PROXY) {
    const finalProxyUrl = PROXY_URL || DEFAULT_PROXY_URL;
    console.log('📍 [配置检查] 代理配置:', finalProxyUrl.replace(/:\/\/.*@/, '://***@'));
    console.log('   (默认使用 Clash 本地代理 127.0.0.1:7890，如需禁用请设置 OPENAI_USE_PROXY=false)');
  } else {
    console.log('📍 [配置检查] 代理已禁用，将直接连接 OpenAI API');
    console.warn('   ⚠️  警告：在国内网络环境下，直接连接可能失败，建议使用代理');
  }
}

// 模块加载时执行配置验证
validateConfig();

/**
 * 调用 GPT API 生成行程
 * @param {Array} collections 收藏的小红书内容数组
 * @param {number} days 行程天数
 * @param {string} budget 预算描述
 * @returns {Promise<Array>} 生成的行程数组，格式: [{ day: 1, date: '2024-01-01', items: [{ time: '09:00', place: 'xxx', description: 'xxx' }] }]
 */
async function generateItinerary(collections, days, budget) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API Key 未配置');
  }

  // 构建提示词
  const placesInfo = collections
    .map(c => `标题：${c.title}\n内容：${c.content}\n地点：${c.places?.join('、') || '未提取'}`)
    .join('\n\n---\n\n');

  const prompt = `你是一个专业的旅行规划师。请根据以下小红书内容，生成一份详细的${days}天行程规划。

小红书内容：
${placesInfo}

预算：${budget || '不限'}

要求：
1. 行程要合理，考虑地点之间的距离和交通时间
2. 每天安排3-5个地点，不要太紧凑
3. 包含用餐时间、休息时间
4. 给出每个地点的简短描述（1-2句话）
5. 按照时间顺序排列

请以 JSON 格式返回，格式如下：
[
  {
    "day": 1,
    "date": "2024-01-01",
    "items": [
      {
        "time": "09:00",
        "place": "地点名称",
        "description": "地点描述"
      }
    ]
  }
]

只返回 JSON 数组，不要其他文字。`;

  try {
    // 配置 axios 请求选项
    const axiosConfig = {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: AXIOS_TIMEOUT // 设置超时时间（60秒）
    };

    // 配置代理：默认使用 Clash 代理（127.0.0.1:7890）
    // 如果设置了 OPENAI_USE_PROXY=false，则不使用代理
    // 如果配置了 OPENAI_PROXY_URL，则使用配置的代理地址
    if (USE_PROXY) {
      const finalProxyUrl = PROXY_URL || DEFAULT_PROXY_URL;
      const proxyAgent = new HttpsProxyAgent(finalProxyUrl);
      axiosConfig.httpsAgent = proxyAgent;
      axiosConfig.httpAgent = proxyAgent;
      console.log('[行程生成] 已配置代理:', finalProxyUrl.replace(/:\/\/.*@/, '://***@')); // 脱敏显示
      console.log('[行程生成] 代理类型: Clash 本地代理（127.0.0.1:7890）');
    } else {
      console.log('[行程生成] 未使用代理，直接连接 OpenAI API（可能在国内网络环境下失败）');
    }

    console.log('[行程生成] 开始调用 OpenAI API，URL:', OPENAI_API_URL);
    
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      },
      axiosConfig
    );

    const content = response.data.choices[0].message.content.trim();
    
    // 提取 JSON 部分（去除可能的代码块标记）
    let jsonStr = content;
    if (content.startsWith('```')) {
      jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
    
    const itinerary = JSON.parse(jsonStr);
    
    // 验证并格式化行程数据
    if (!Array.isArray(itinerary)) {
      throw new Error('返回格式不正确：应为数组');
    }
    
    return itinerary.map(day => ({
      day: day.day || 1,
      date: day.date || '',
      items: (day.items || []).map(item => ({
        time: item.time || '00:00',
        place: item.place || '',
        description: item.description || ''
      }))
    }));
  } catch (error) {
    // 详细错误日志
    console.error('[行程生成] GPT API 调用失败:', {
      errorMessage: error.message,
      errorCode: error.code,
      responseStatus: error.response?.status,
      responseData: error.response?.data,
      usingProxy: USE_PROXY,
      proxyUrl: USE_PROXY ? (PROXY_URL || DEFAULT_PROXY_URL).replace(/:\/\/.*@/, '://***@') : '未使用'
    });

    // 处理不同类型的错误
    if (error.response) {
      // API 返回了错误响应
      const status = error.response.status;
      const errorMsg = error.response.data?.error?.message || error.message;
      
      // 402 错误：OpenAI Billing 未配置/配额不足
      if (status === 402) {
        throw new Error('OpenAI Billing 未配置或配额不足，请检查 OpenAI 账户设置（无需修改代码）');
      }
      
      throw new Error(`OpenAI API 错误 (${status}): ${errorMsg}`);
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      // 请求超时
      if (USE_PROXY) {
        throw new Error('AI 服务请求超时，请检查：1. Clash 代理是否已启动；2. 代理端口是否为 7890；3. 网络连接是否正常');
      }
      throw new Error('AI 服务请求超时，请检查网络连接或稍后重试');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      // 连接超时或拒绝连接
      const invalidIPs = ['47.88.58.234', '31.13.91.6', '173.252.105.21', '118.193.240.37'];
      if (invalidIPs.some(ip => error.message.includes(ip))) {
        throw new Error(`AI 服务地址配置错误（检测到无效IP: ${invalidIPs.find(ip => error.message.includes(ip))}），请检查 .env 文件中的 OPENAI_API_URL 配置。建议使用: https://api.openai.com/v1`);
      }
      
      // 如果是代理连接错误
      if (USE_PROXY && (error.code === 'ECONNREFUSED' || error.message.includes('127.0.0.1') || error.message.includes('7890'))) {
        throw new Error('Clash 代理连接失败，请检查：1. Clash 是否已启动；2. 代理端口是否为 7890；3. 代理设置是否正确');
      }
      
      throw new Error(`AI 服务连接失败: ${error.message}，请检查 .env 文件中的 OPENAI_API_URL 和代理配置`);
    } else if (error.code === 'ECONNRESET') {
      // 连接被重置（可能是代理问题）
      if (USE_PROXY) {
        throw new Error('代理连接被重置，请检查 Clash 代理是否正常运行');
      }
      throw new Error('连接被重置，请检查网络连接');
    } else if (error instanceof SyntaxError) {
      // JSON 解析错误
      throw new Error(`GPT 返回的 JSON 格式错误: ${error.message}`);
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      // DNS 解析失败
      if (USE_PROXY) {
        throw new Error('DNS 解析失败，请检查 Clash 代理是否正常工作');
      }
      throw new Error('AI 服务地址无法解析，请检查 OPENAI_API_URL 配置是否正确');
    } else {
      // 其他错误
      throw new Error(`AI 服务调用失败: ${error.message}`);
    }
  }
}

module.exports = {
  generateItinerary,
  validateConfig // 导出配置验证函数，供 app.js 使用
};

