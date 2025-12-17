/**
 * 测试路由
 * 提供各种测试接口，用于开发调试
 * 
 * 注意：此路由仅用于开发调试，生产环境应移除或添加严格权限控制
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { OpenAI } = require('openai');
const { HttpsProxyAgent } = require('https-proxy-agent');

// 加载环境变量（确保.env文件被正确读取）
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// 环境变量验证日志（确保密钥能被正确获取）
console.log(`[环境变量验证] OPENAI_API_KEY是否存在：${process.env.OPENAI_API_KEY ? '是' : '否'}`);
if (process.env.OPENAI_API_KEY) {
  console.log(`[环境变量验证] OPENAI_API_KEY前缀：${process.env.OPENAI_API_KEY.substring(0, 10)}...`); // 仅打印前10位，避免泄露密钥
  console.log(`[环境变量验证] OPENAI_API_KEY长度：${process.env.OPENAI_API_KEY.length} 字符`);
} else {
  console.warn('[环境变量验证] ⚠️  OPENAI_API_KEY 未配置，请在 .env 文件中配置');
}

/**
 * 测试GPT代理接口：验证代理能否正常调用chat/completions
 * 完整访问路径：GET http://localhost:3006/api/test/test-gpt-proxy（需拼接 /api/test 前缀）
 * 
 * 注意：由于 testRoutes 在 app.js 中被挂载到 /api/test 前缀下，
 *       因此接口的完整路径是 /api/test/test-gpt-proxy，而非 /test-gpt-proxy
 */
router.get('/test-gpt-proxy', async (req, res) => {
  // 统一代理配置（使用Clash的7890端口，如果环境变量未设置则使用默认值）
  const DEFAULT_PROXY_URL = 'http://127.0.0.1:7890'; // Clash默认代理端口
  const PROXY_URL = process.env.OPENAI_PROXY_URL;
  const finalProxyUrl = PROXY_URL || DEFAULT_PROXY_URL;
  
  // 配置Clash的本地代理（端口7890）
  const proxyAgent = new HttpsProxyAgent(finalProxyUrl);
  console.log(`[GPT测试] 已配置Clash代理（端口7890），开始测试连接...`);
  console.log(`[GPT测试] 代理地址: ${finalProxyUrl.replace(/:\/\/.*@/, '://***@')}`); // 脱敏显示
  
  const startTime = Date.now();
  
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      return res.json({
        code: 1,
        data: {
          success: false,
          error: { message: 'OpenAI API Key 未配置' },
          duration: `${Date.now() - startTime}ms`,
          proxyConfigured: true, // 代理已配置
          proxyUrl: finalProxyUrl.replace(/:\/\/.*@/, '://***@')
        },
        msg: 'OpenAI API Key 未配置，请在 .env 文件中配置 OPENAI_API_KEY'
      });
    }
    
    // 验证API密钥格式（OpenAI API密钥通常以 sk- 开头）
    if (!OPENAI_API_KEY.startsWith('sk-')) {
      console.warn('[GPT测试] 警告：API密钥格式可能不正确（应以 sk- 开头）');
    }
    
    console.log(`[GPT测试] API密钥已配置（长度: ${OPENAI_API_KEY.length}，前缀: ${OPENAI_API_KEY.substring(0, 7)}...）`);
    
    // 初始化OpenAI实例（确保代理生效）
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY, // 从环境变量读取，避免硬编码
      httpAgent: proxyAgent,
      httpsAgent: proxyAgent,
      timeout: 30000, // 30秒超时
      maxRetries: 2 // 重试2次
    });
    
    console.log('[GPT测试] 开始测试GPT代理连接...');
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "user", 
          content: '请返回"测试成功"' // 使用英文单引号包裹，内部用英文双引号
        }
      ],
      max_tokens: 10,
      temperature: 0
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const result = response.choices[0].message.content;
    
    console.log(`[GPT测试] 测试成功，耗时: ${duration}ms`);
    
    // 修正：代理已配置，所以proxyConfigured为true
    res.json({
      code: 0,
      data: {
        success: true,
        result: result,
        duration: `${duration}ms`,
        proxyConfigured: true, // 改为true（因为已配置代理）
        proxyUrl: finalProxyUrl.replace(/:\/\/.*@/, '://***@') // 显示实际代理地址（脱敏）
      },
      msg: 'GPT代理测试成功'
    });
  } catch (error) {
    console.error('[GPT测试] 测试失败:', error);
    
    // 计算耗时（如果startTime存在）
    const endTime = Date.now();
    const duration = typeof startTime !== 'undefined' ? endTime - startTime : 0;
    
    const errorDetails = {
      message: error.message,
      type: error.constructor.name,
      code: error.code,
      status: error.status
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
      if (error.response.data) {
        errorDetails.responseData = typeof error.response.data === 'string' 
          ? error.response.data.substring(0, 200) 
          : error.response.data;
      }
    }
    
    // 修正：代理已配置，所以proxyConfigured为true（代理已配置，只是密钥/其他问题）
    const DEFAULT_PROXY_URL = 'http://127.0.0.1:7890';
    const finalProxyUrl = PROXY_URL || DEFAULT_PROXY_URL;
    
    res.json({
      code: 1,
      data: {
        success: false,
        error: errorDetails,
        duration: `${duration}ms`,
        proxyConfigured: true, // 这里也改为true（代理已配置，只是密钥/其他问题）
        proxyUrl: finalProxyUrl.replace(/:\/\/.*@/, '://***@') // 显示实际代理地址（脱敏）
      },
      msg: `GPT代理测试失败: ${error.message}`
    });
  }
});

module.exports = router;

