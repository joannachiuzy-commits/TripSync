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

/**
 * AI判断内容类型并提取对应关键词（新增功能）
 * @param {string} title 小红书笔记标题
 * @param {string} content 小红书笔记正文
 * @returns {Promise<{type: string, keywords: Array<string>}>} 返回类型和关键词
 */
async function parseContentTypeAndKeywords(title, content) {
  // 如果没有配置API密钥，使用降级方案
  if (!QWEN_API_KEY) {
    console.log('[内容解析] 使用降级方案：仅提取地点标签');
    const tags = oldKeywordTagExtractor(content);
    return {
      type: '其他',
      keywords: tags
    };
  }

  // 如果内容为空或过短，使用降级方案
  const fullText = `${title || ''}\n${content || ''}`.trim();
  if (fullText.length < 10) {
    console.log('[内容解析] 内容过短，使用降级方案');
    const tags = oldKeywordTagExtractor(content);
    return {
      type: '其他',
      keywords: tags
    };
  }

  try {
    console.log('[内容解析] 使用通义千问判断类型并提取关键词，内容长度:', fullText.length);
    
    // 构建通义千问API请求
    const prompt = `请完成以下任务：

1. 判断以下小红书内容的类型（可选：美食、景点、游玩攻略、其他）；
2. 根据类型提取对应关键词：
   - 美食类：提取所有餐厅/店铺的名字（如"李百蟹蟹黄面"、"泮芳春煎饺"）；
   - 景点类：提取所有景点的名字（如"杭州西湖"、"灵隐寺"）；
   - 游玩攻略类：提取核心地点/主题词；
   - 其他类：提取核心地点/主题词；

3. 返回标准JSON格式，包含字段：
   - type（内容类型，字符串）："美食"、"景点"、"游玩攻略"、"其他"之一
   - keywords（关键词数组，字符串数组）：根据类型提取的关键词列表

要求：
- 只返回JSON对象，不要加任何额外文字/解释
- keywords数组中的每个元素都是字符串
- 不重复提取关键词
- 美食类必须提取餐厅/店铺名称，不要提取地点

示例（美食类）：
{
  "type": "美食",
  "keywords": ["李百蟹蟹黄面", "泮芳春煎饺", "龙翔臭豆腐"]
}

示例（景点类）：
{
  "type": "景点",
  "keywords": ["杭州西湖", "灵隐寺", "西溪湿地"]
}

小红书内容：
标题：${title || '无标题'}
正文：${fullText.length > 2000 ? fullText.substring(0, 2000) + '...' : fullText}`;

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
          result_format: "message",
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

    // 适配通义千问返回格式
    const aiContent = response.data.output?.choices?.[0]?.message?.content || 
                      response.data.output?.text || 
                      '';
    
    if (!aiContent) {
      throw new Error('通义千问返回内容为空');
    }

    // 预处理：提取JSON对象
    let jsonStr = aiContent.trim()
      .replace(/[\n\r]/g, "") // 去掉换行
      .replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*?$/, "$1"); // 提取大括号包裹的JSON对象

    console.log('[内容解析] 通义千问返回原始结果:', aiContent.trim());
    console.log('[内容解析] 预处理后的结果:', jsonStr);

    // 解析JSON
    let result;
    try {
      result = JSON.parse(jsonStr);
      
      // 验证结果格式
      if (!result || typeof result !== 'object') {
        throw new Error("返回的不是有效的JSON对象");
      }

      // 验证type字段
      const validTypes = ['美食', '景点', '游玩攻略', '其他'];
      if (!result.type || !validTypes.includes(result.type)) {
        console.warn('[内容解析] 类型不在预期范围内，使用默认值"其他"');
        result.type = '其他';
      }

      // 验证keywords字段
      if (!Array.isArray(result.keywords)) {
        result.keywords = [];
      }

      // 过滤和清理关键词
      result.keywords = result.keywords
        .filter(kw => kw && typeof kw === 'string' && kw.trim().length > 0)
        .map(kw => kw.trim())
        .filter((kw, index, self) => self.indexOf(kw) === index); // 去重

      console.log('[内容解析] 通义千问成功解析 - 类型:', result.type, '关键词:', result.keywords);
      return result;
    } catch (parseError) {
      console.error('[内容解析] JSON解析失败，降级到关键词匹配：', parseError.message);
      const tags = oldKeywordTagExtractor(content);
      return {
        type: '其他',
        keywords: tags
      };
    }
  } catch (error) {
    // 打印详细错误
    const errorDetails = {
      message: error.message,
      type: error.constructor.name,
      code: error.code
    };
    
    if (error.request) {
      errorDetails.requestUrl = error.request.url || error.request.path;
      errorDetails.requestMethod = error.request.method;
    }
    
    if (error.response) {
      errorDetails.responseStatus = error.response.status;
      errorDetails.responseStatusText = error.response.statusText;
      errorDetails.responseData = error.response.data;
    }
    
    console.error('[内容解析] 通义千问调用详细错误：', JSON.stringify(errorDetails, null, 2));
    console.error('[内容解析] 错误堆栈：', error.stack);
    
    // 降级到关键词匹配
    const tags = oldKeywordTagExtractor(content);
    return {
      type: '其他',
      keywords: tags
    };
  }
}

module.exports = { 
  extractTagsByGPT,
  oldKeywordTagExtractor,
  parseContentTypeAndKeywords // 新增导出
};

