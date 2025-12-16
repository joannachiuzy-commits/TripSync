/**
 * 大模型标签提取工具
 * 使用 OpenAI GPT 从小红书笔记正文中提取景点/地点标签
 */

const { OpenAI } = require('openai');
const { HttpsProxyAgent } = require('https-proxy-agent');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PROXY_URL = process.env.OPENAI_PROXY_URL; // 代理地址，格式：http://代理地址:端口

// 初始化 OpenAI 客户端（如果API密钥存在）
let openai = null;
if (OPENAI_API_KEY) {
  const config = {
    apiKey: OPENAI_API_KEY
  };
  
  // 如果配置了代理，则使用代理
  if (PROXY_URL) {
    config.httpAgent = new HttpsProxyAgent(PROXY_URL);
    console.log('[标签提取] 已配置代理:', PROXY_URL.replace(/:\/\/.*@/, '://***@')); // 脱敏显示
  }
  
  openai = new OpenAI(config);
} else {
  console.warn('[标签提取] OpenAI API Key 未配置，将使用关键词匹配降级方案');
}

/**
 * 从正文提取景点/地点标签（使用大模型）
 * @param {string} content 小红书笔记正文
 * @returns {Promise<Array<string>>} 提取的标签数组
 */
async function extractTagsByGPT(content) {
  // 如果没有配置API密钥，直接使用降级方案
  if (!openai || !OPENAI_API_KEY) {
    console.log('[标签提取] 使用关键词匹配降级方案');
    return oldKeywordTagExtractor(content);
  }

  // 如果内容为空或过短，直接返回空数组
  if (!content || content.trim().length < 10) {
    console.log('[标签提取] 内容过短，跳过大模型提取');
    return oldKeywordTagExtractor(content);
  }

  try {
    console.log('[标签提取] 使用GPT提取标签，内容长度:', content.length);
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "请从以下小红书正文中，提取**所有出现的景点/地点名称**（不重复，不要遗漏任何景点），仅返回标准JSON数组（仅包含字符串元素），不要加任何额外文字/解释。要求：1. 提取正文里所有出现的景点，不要遗漏；2. 只返回景点/地点名称；3. 不重复。示例：[\"杭州西湖\", \"灵隐寺\", \"西溪湿地\"]"
        },
        { 
          role: "user", 
          content: content.length > 2000 ? content.substring(0, 2000) + '...' : content
        }
      ],
      temperature: 0, // 降低随机性，保证精准
      max_tokens: 100
    });

    // 预处理：去除返回内容的多余空格、换行，只保留核心数组
    let tagsStr = response.choices[0].message.content.trim()
      .replace(/[\n\r]/g, "") // 去掉换行
      .replace(/^[\s\S]*?(\[.*\])[\s\S]*?$/, "$1"); // 提取中括号包裹的数组部分

    console.log('[标签提取] GPT返回原始结果:', response.choices[0].message.content.trim());
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
        console.log('[标签提取] GPT成功提取标签:', tags);
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
    console.error('[标签提取] 大模型调用失败：', error.message);
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

