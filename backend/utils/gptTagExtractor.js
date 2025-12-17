/**
 * 大模型标签提取工具
 * 使用通义千问 API 从小红书笔记正文中提取景点/地点标签
 */

const axios = require('axios');

// ========== 通义千问配置 ==========
const QWEN_API_KEY = process.env.QWEN_API_KEY;
const QWEN_API_URL = process.env.QWEN_API_URL || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const QWEN_DEFAULT_MODEL = process.env.QWEN_DEFAULT_MODEL || 'qwen-turbo';

// 配置 axios 默认超时时间（30秒）
const AXIOS_TIMEOUT = 30000;

if (QWEN_API_KEY) {
  console.log('[标签提取] 通义千问 API Key 已配置');
} else {
  console.warn('[标签提取] 通义千问 API Key 未配置，将使用关键词匹配降级方案');
}

/**
 * 从正文提取景点/地点标签（使用大模型）
 * @param {string} content 小红书笔记正文
 * @returns {Promise<Array<string>>} 提取的标签数组
 */
async function extractTagsByGPT(content) {
  // 如果没有配置API密钥，直接使用降级方案
  if (!QWEN_API_KEY) {
    console.log('[标签提取] 使用关键词匹配降级方案');
    return oldKeywordTagExtractor(content);
  }

  // 如果内容为空或过短，直接返回空数组
  if (!content || content.trim().length < 10) {
    console.log('[标签提取] 内容过短，跳过大模型提取');
    return oldKeywordTagExtractor(content);
  }

  try {
    console.log('[标签提取] 使用通义千问提取标签，内容长度:', content.length);
    
    // 构建通义千问API请求
    const prompt = `请从以下小红书正文中，提取**所有出现的景点/地点名称**（不重复，不要遗漏任何景点），仅返回标准JSON数组（仅包含字符串元素），不要加任何额外文字/解释。要求：1. 提取正文里所有出现的景点，不要遗漏；2. 只返回景点/地点名称；3. 不重复。示例：["杭州西湖", "灵隐寺", "西溪湿地"]

正文内容：
${content.length > 2000 ? content.substring(0, 2000) + '...' : content}`;

    const response = await axios.post(
      QWEN_API_URL,
      {
        model: QWEN_DEFAULT_MODEL,
        input: {
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        },
        parameters: {
          result_format: "message", // 使用message格式，保证返回格式与原GPT一致
          temperature: 0, // 降低随机性，保证精准
          top_p: 0.8
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${QWEN_API_KEY}`
        },
        timeout: AXIOS_TIMEOUT
      }
    );

    // 适配通义千问返回格式到原GPT的返回格式（保证出参结构一致）
    const aiContent = response.data.output?.choices?.[0]?.message?.content || 
                      response.data.output?.text || 
                      '';
    
    if (!aiContent) {
      throw new Error('通义千问返回内容为空');
    }

    // 预处理：去除返回内容的多余空格、换行，只保留核心数组
    let tagsStr = aiContent.trim()
      .replace(/[\n\r]/g, "") // 去掉换行
      .replace(/^[\s\S]*?(\[.*\])[\s\S]*?$/, "$1"); // 提取中括号包裹的数组部分

    console.log('[标签提取] 通义千问返回原始结果:', aiContent.trim());
    console.log('[标签提取] 预处理后的结果:', tagsStr);

    // 捕获JSON解析错误，失败则降级
    let tags;
    try {
      tags = JSON.parse(tagsStr);
      
      // 确保是数组且元素是字符串
      if (!Array.isArray(tags) || !tags.every(item => typeof item === "string")) {
        throw new Error("不是合法的标签数组");
      }
      
      // 过滤和清理标签
      tags = tags
        .filter(tag => tag && typeof tag === 'string' && tag.trim().length > 0)
        .map(tag => tag.trim())
        .filter((tag, index, self) => self.indexOf(tag) === index); // 去重
      
      if (tags.length > 0) {
        console.log('[标签提取] 通义千问成功提取标签:', tags);
        return tags;
      } else {
        throw new Error('提取的标签数组为空');
      }
    } catch (parseError) {
      console.error('[标签提取] 标签解析失败，降级到关键词匹配：', parseError.message);
      tags = oldKeywordTagExtractor(content);
      return tags;
    }
  } catch (error) {
    // 打印详细错误（含请求URL、状态码等）
    const errorDetails = {
      message: error.message,
      type: error.constructor.name,
      code: error.code
    };
    
    // 尝试获取请求相关信息
    if (error.request) {
      errorDetails.requestUrl = error.request.url || error.request.path;
      errorDetails.requestMethod = error.request.method;
    }
    
    // 尝试获取响应相关信息
    if (error.response) {
      errorDetails.responseStatus = error.response.status;
      errorDetails.responseStatusText = error.response.statusText;
      errorDetails.responseData = error.response.data;
    }
    
    console.error('[标签提取] 通义千问调用详细错误：', JSON.stringify(errorDetails, null, 2));
    console.error('[标签提取] 错误堆栈：', error.stack);
    
    // 降级到关键词匹配
    return oldKeywordTagExtractor(content);
  }
}

/**
 * 原有关键词匹配函数（保留，作为降级方案）
 * @param {string} content 小红书笔记正文
 * @returns {Array<string>} 提取的标签数组
 */
function oldKeywordTagExtractor(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  // 关键词列表（优化：去掉无关词，补充目标景点）
  const keywords = [
    // 杭州相关景点
    "杭州西湖", 
    "灵隐寺", 
    "西溪湿地", 
    "河坊街", 
    "京杭大运河", 
    "千岛湖", 
    "小河直街", 
    "良渚遗址公园", 
    "杭州植物园", 
    "杭州", 
    "西湖",
    // 西安相关景点（补充）
    "西安", 
    "兵马俑", 
    "西安钟楼", 
    "西安鼓楼", 
    "西安城墙", 
    "大唐不夜城", 
    "大雁塔", 
    "大唐芙蓉园", 
    "陕西历史博物馆", 
    "华清宫",
    "钟楼",
    "鼓楼",
    "城墙",
    "不夜城",
    "芙蓉园"
  ];
  
  // 去重并过滤存在的关键词
  const matchedTags = keywords.filter(keyword => content.includes(keyword));
  const uniqueTags = [...new Set(matchedTags)];
  
  if (uniqueTags.length > 0) {
    console.log('[标签提取] 关键词匹配提取到标签:', uniqueTags);
  }
  
  return uniqueTags;
}

module.exports = { 
  extractTagsByGPT,
  oldKeywordTagExtractor 
};

