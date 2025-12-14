/**
 * 大模型标签提取工具
 * 使用 OpenAI GPT 从小红书笔记正文中提取景点/地点标签
 */

const { OpenAI } = require('openai');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 初始化 OpenAI 客户端（如果API密钥存在）
let openai = null;
if (OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
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
          content: `请你从以下小红书笔记正文中，提取所有提到的景点名称（如"杭州西湖""灵隐寺"），要求：

1. 不重复；
2. 只保留景点/地点名称；
3. 输出格式为**纯JSON数组字符串**（仅数组，无任何多余文字、空格、换行），例如：["杭州西湖","灵隐寺","西溪湿地"]`
        },
        { 
          role: "user", 
          content: content.length > 2000 ? content.substring(0, 2000) + '...' : content
        }
      ],
      temperature: 0, // 降低随机性，保证精准
      max_tokens: 200
    });

    // 获取大模型返回的原始内容
    const rawContent = response.choices[0].message.content.trim();
    console.log('[标签提取] GPT返回原始结果:', rawContent);

    // 预处理：清理多余字符（空格、换行、中文引号→英文引号）
    let tagsStr = rawContent
      .replace(/```json\n?/gi, '') // 移除代码块标记（不区分大小写）
      .replace(/```\n?/g, '') // 移除代码块结束标记
      .replace(/^`|`$/g, '') // 移除可能的代码块符号
      .replace(/[""]/g, '"') // 中文双引号转英文双引号
      .replace(/['']/g, "'") // 中文单引号转英文单引号
      .replace(/\s+/g, '') // 移除所有空格和换行（在引号转换之后，确保JSON格式正确）
      .trim();

    console.log('[标签提取] 预处理后的结果:', tagsStr);

    // 尝试解析JSON数组
    let tags = [];
    try {
      // 尝试直接解析JSON
      tags = JSON.parse(tagsStr);
      
      // 确保是数组
      if (!Array.isArray(tags)) {
        throw new Error('返回结果不是数组');
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
      console.warn('[标签提取] JSON解析失败，尝试从文本中提取:', parseError.message);
      
      // 降级：尝试从返回的文本中提取（可能返回的是纯文本列表）
      const lines = rawContent.split('\n').map(line => line.trim()).filter(line => line);
      tags = lines
        .map(line => {
          // 移除列表标记（如 "- ", "1. ", "• " 等）
          return line.replace(/^[-•\d.]+\s*/, '').replace(/^["'"]|["'"]$/g, '').trim();
        })
        .filter(tag => tag.length > 0 && tag.length < 50); // 过滤过长或过短的标签
      
      if (tags.length > 0) {
        console.log('[标签提取] 从文本中提取到标签:', tags);
        return tags;
      }
      
      // 如果还是失败，使用降级方案
      throw parseError;
    }
  } catch (error) {
    console.error('[标签提取] 大模型提取标签失败:', error.message);
    console.log('[标签提取] 降级到关键词匹配方案');
    
    // 降级：回退到原有关键词匹配（保留原有的标签提取逻辑）
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

  // 扩展地点关键词（包含更多城市和景点）
  const cityPattern = /(北京|上海|广州|深圳|杭州|成都|西安|南京|武汉|重庆|天津|苏州|长沙|郑州|青岛|沈阳|大连|厦门|福州|哈尔滨|济南|石家庄|长春|昆明|合肥|南宁|太原|贵阳|呼和浩特|乌鲁木齐|拉萨|银川|西宁|海口|三亚|丽江|大理|桂林|张家界|黄山|九寨沟|峨眉山|泰山|华山|庐山|武夷山|普陀山|五台山|武当山|青城山|长白山|天山|昆仑山|喜马拉雅|珠穆朗玛|布达拉宫|故宫|天安门|长城|兵马俑|西湖|阳朔|西双版纳|香格里拉|稻城亚丁|泸沽湖|洱海|滇池|青海湖|纳木错|茶卡盐湖|莫高窟|龙门石窟|云冈石窟|大足石刻|乐山大佛|都江堰|乌镇|周庄|同里|西塘|宏村|婺源|凤凰古城|平遥古城|丽江古城|大理古城|鼓浪屿|天涯海角|亚龙湾|蜈支洲岛|涠洲岛|长岛|崇明岛|舟山|千岛湖|天池|镜泊湖|松花江|长江|黄河|珠江|淮河|太湖|鄱阳湖|洞庭湖|洪泽湖|巢湖|滇池|洱海|青海湖|纳木错|羊卓雍错|玛旁雍错|色林错|班公错|茶卡盐湖|察尔汗盐湖|罗布泊|塔克拉玛干|腾格里|巴丹吉林|库布齐|毛乌素|呼伦贝尔|锡林郭勒|科尔沁|鄂尔多斯|阿拉善|那拉提|巴音布鲁克|喀纳斯|禾木|白哈巴|可可托海|天山天池|赛里木湖|喀拉峻|那拉提|巴音布鲁克|昭苏|特克斯|伊犁|吐鲁番|哈密|库尔勒|阿克苏|喀什|和田|阿勒泰|塔城|博尔塔拉|克孜勒苏|昌吉|石河子|五家渠|图木舒克|阿拉尔|铁门关|可克达拉|双河|昆玉|胡杨河|新星|白杨|北屯|可克达拉|双河|昆玉|胡杨河|新星|白杨|北屯|灵隐寺|西溪湿地|雷峰塔|断桥|三潭印月|苏堤|白堤|岳王庙|六和塔|虎跑|龙井|梅家坞|九溪|云栖竹径|法喜寺|净慈寺|保俶塔|宝石山|太子湾|花港观鱼|曲院风荷|平湖秋月|断桥残雪|柳浪闻莺|双峰插云|三潭印月|南屏晚钟|雷峰夕照|苏堤春晓|花港观鱼|曲院风荷|平湖秋月|断桥残雪|柳浪闻莺|双峰插云|三潭印月|南屏晚钟|雷峰夕照|苏堤春晓)/g;
  
  const matches = content.match(cityPattern);
  if (matches) {
    // 去重并限制数量
    const uniqueTags = [...new Set(matches)].slice(0, 10);
    console.log('[标签提取] 关键词匹配提取到标签:', uniqueTags);
    return uniqueTags;
  }
  
  return [];
}

module.exports = { 
  extractTagsByGPT,
  oldKeywordTagExtractor 
};

