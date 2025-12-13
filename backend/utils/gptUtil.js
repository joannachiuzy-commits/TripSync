/**
 * OpenAI GPT API 工具
 * 封装 GPT 请求，用于生成行程
 */

const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

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
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
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
    if (error.response) {
      throw new Error(`OpenAI API 错误: ${error.response.data.error?.message || error.message}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`GPT 返回的 JSON 格式错误: ${error.message}`);
    }
    throw error;
  }
}

module.exports = {
  generateItinerary
};

