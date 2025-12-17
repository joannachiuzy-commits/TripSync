/**
 * AI 模型调用工具
 * 支持 GPT 和通义千问，实现自动切换和手动选择
 */

const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

// ========== GPT 配置 ==========
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_BASE = process.env.OPENAI_API_URL || 'https://api.openai.com/v1';
const PROXY_URL = process.env.OPENAI_PROXY_URL;
const CLASH_PROXY_HOST = process.env.CLASH_PROXY_HOST || '127.0.0.1';
const CLASH_PROXY_PORT = process.env.CLASH_PROXY_PORT || '7890';
const DEFAULT_PROXY_URL = `http://${CLASH_PROXY_HOST}:${CLASH_PROXY_PORT}`;
const USE_PROXY = process.env.OPENAI_USE_PROXY !== 'false'; // 默认使用代理

// ========== 通义千问配置 ==========
const QWEN_API_KEY = process.env.QWEN_API_KEY;
const QWEN_API_URL = process.env.QWEN_API_URL || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const QWEN_DEFAULT_MODEL = process.env.QWEN_DEFAULT_MODEL || 'qwen-turbo';

// 配置 axios 默认超时时间（60秒）
const AXIOS_TIMEOUT = 60000;

// 构建完整的 GPT API URL
function getOpenAIApiUrl() {
  if (OPENAI_API_BASE.includes('/chat/completions')) {
    return OPENAI_API_BASE;
  }
  const baseUrl = OPENAI_API_BASE.endsWith('/') ? OPENAI_API_BASE.slice(0, -1) : OPENAI_API_BASE;
  return `${baseUrl}/chat/completions`;
}

const OPENAI_API_URL = getOpenAIApiUrl();

// 模型配置映射
const MODEL_CONFIG = {
  gpt: {
    name: 'GPT',
    url: OPENAI_API_URL,
    apiKey: OPENAI_API_KEY,
    getProxyAgent: () => {
      if (!USE_PROXY) return null;
      const finalProxyUrl = PROXY_URL || DEFAULT_PROXY_URL;
      return new HttpsProxyAgent(finalProxyUrl);
    },
    buildRequest: (prompt) => ({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    }),
    getHeaders: () => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    }),
    parseResponse: (response) => {
      return response.data.choices[0].message.content.trim();
    }
  },
  qwen: {
    name: '通义千问',
    url: QWEN_API_URL,
    apiKey: QWEN_API_KEY,
    getProxyAgent: () => null, // 通义千问无需代理
    buildRequest: (prompt) => ({
      model: QWEN_DEFAULT_MODEL,
      input: {
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      parameters: {
        result_format: 'message',
        temperature: 0.7,
        top_p: 0.8
      }
    }),
    getHeaders: () => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${QWEN_API_KEY}`
    }),
    parseResponse: (response) => {
      return response.data.output.choices[0].message.content.trim();
    }
  }
};

// 启动时验证配置
function validateConfig() {
  console.log('\n📋 AI 模型配置检查...\n');
  
  // GPT 配置检查
  if (!OPENAI_API_KEY) {
    console.warn('⚠️  [配置检查] OPENAI_API_KEY 未配置，GPT 模型将不可用');
  } else {
    console.log('✅ [配置检查] OPENAI_API_KEY 已配置（长度:', OPENAI_API_KEY.length, '字符）');
  }
  console.log('📍 [配置检查] GPT API 地址:', OPENAI_API_URL);
  
  if (USE_PROXY) {
    const finalProxyUrl = PROXY_URL || DEFAULT_PROXY_URL;
    console.log('📍 [配置检查] GPT 代理配置:', finalProxyUrl.replace(/:\/\/.*@/, '://***@'));
  } else {
    console.log('📍 [配置检查] GPT 代理已禁用');
  }
  
  // 通义千问配置检查
  if (!QWEN_API_KEY) {
    console.warn('⚠️  [配置检查] QWEN_API_KEY 未配置，通义千问模型将不可用');
  } else {
    console.log('✅ [配置检查] QWEN_API_KEY 已配置（长度:', QWEN_API_KEY.length, '字符）');
  }
  console.log('📍 [配置检查] 通义千问 API 地址:', QWEN_API_URL);
  console.log('📍 [配置检查] 通义千问模型:', QWEN_DEFAULT_MODEL);
  console.log('📍 [配置检查] 通义千问无需代理（国内直连）\n');
}

// 模块加载时执行配置验证
validateConfig();

/**
 * 调用指定 AI 模型
 * @param {string} prompt 提示词
 * @param {string} modelType 模型类型：'gpt' | 'qwen' | 'auto'
 * @returns {Promise<string>} 生成的文本内容
 */
async function callAIModel(prompt, modelType = 'auto') {
  // 确定要调用的模型列表
  let targetModels = [];
  if (modelType === 'auto') {
    // 自动模式：优先 GPT，失败后切换通义千问
    targetModels = ['gpt', 'qwen'];
  } else if (modelType === 'gpt' || modelType === 'qwen') {
    targetModels = [modelType];
  } else {
    throw new Error(`不支持的模型类型：${modelType}，支持的类型：gpt、qwen、auto`);
  }

  let lastError = null;

  for (const model of targetModels) {
    const config = MODEL_CONFIG[model];
    
    if (!config) {
      console.warn(`⚠️  模型 ${model} 未配置，跳过`);
      continue;
    }

    if (!config.apiKey) {
      console.warn(`⚠️  模型 ${config.name} 的 API Key 未配置，跳过`);
      continue;
    }

    try {
      console.log(`[AI调用] 正在调用 ${config.name} 模型...`);
      
      const proxyAgent = config.getProxyAgent();
      const axiosConfig = {
        headers: config.getHeaders(),
        timeout: AXIOS_TIMEOUT
      };

      if (proxyAgent) {
        axiosConfig.httpsAgent = proxyAgent;
        axiosConfig.httpAgent = proxyAgent;
        console.log(`[AI调用] ${config.name} 已配置代理`);
      }

      const response = await axios.post(
        config.url,
        config.buildRequest(prompt),
        axiosConfig
      );

      const content = config.parseResponse(response);
      console.log(`[AI调用] ${config.name} 调用成功`);
      
      return {
        content,
        model: model,
        modelName: config.name
      };
    } catch (error) {
      console.error(`[AI调用] ${config.name} 调用失败:`, {
        errorMessage: error.message,
        errorCode: error.code,
        responseStatus: error.response?.status
      });

      lastError = error;

      // 如果是自动模式且不是最后一个模型，继续尝试下一个
      if (modelType === 'auto' && model !== targetModels[targetModels.length - 1]) {
        const nextModel = targetModels[targetModels.indexOf(model) + 1];
        console.log(`[AI调用] 自动切换到 ${MODEL_CONFIG[nextModel].name} 模型...`);
        continue;
      }

      // 非自动模式或最后一个模型失败，抛出错误
      if (error.response) {
        const status = error.response.status;
        const errorMsg = error.response.data?.error?.message || error.message;
        
        if (status === 402) {
          throw new Error(`${config.name} Billing 未配置或配额不足，请检查账户设置`);
        }
        
        throw new Error(`${config.name} API 错误 (${status}): ${errorMsg}`);
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
        if (model === 'gpt' && USE_PROXY) {
          throw new Error(`GPT 代理连接失败，请检查：1. Clash 是否已启动；2. 代理端口是否为 ${CLASH_PROXY_PORT}；3. 代理设置是否正确`);
        }
        throw new Error(`${config.name} 连接失败: ${error.message}`);
      } else {
        throw new Error(`${config.name} 调用失败: ${error.message}`);
      }
    }
  }

  // 所有模型都失败
  if (lastError) {
    throw lastError;
  }
  
  throw new Error('没有可用的 AI 模型，请检查配置');
}

/**
 * 调用 AI 模型生成行程
 * @param {Array} collections 收藏的小红书内容数组
 * @param {number} days 行程天数
 * @param {string} budget 预算描述
 * @param {string} modelType 模型类型：'gpt' | 'qwen' | 'auto'，默认 'auto'
 * @returns {Promise<Array>} 生成的行程数组
 */
async function generateItinerary(collections, days, budget, modelType = 'auto') {
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
    const result = await callAIModel(prompt, modelType);
    const content = result.content;
    
    console.log(`[行程生成] 使用 ${result.modelName} 生成成功`);

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

    return {
      itinerary: itinerary.map(day => ({
        day: day.day || 1,
        date: day.date || '',
        items: (day.items || []).map(item => ({
          time: item.time || '00:00',
          place: item.place || '',
          description: item.description || ''
        }))
      })),
      model: result.model,
      modelName: result.modelName
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`AI 返回的 JSON 格式错误: ${error.message}`);
    }
    throw error;
  }
}

module.exports = {
  generateItinerary,
  callAIModel,
  validateConfig
};
