/**
 * 配置路由
 * 提供配置信息接口（不返回敏感信息）
 * 
 * 注意：禁止在前端代码硬编码密钥，所有密钥通过 .env 管理，前端仅通过后端接口获取必要配置
 */

const express = require('express');
const router = express.Router();
const { getConfig } = require('../utils/amapUtil');
const { getCurrentUser } = require('./user');

/**
 * 简化的用户登录状态检查（从 localStorage 获取的用户信息）
 * 注意：这里只是示例，实际应该使用更严格的鉴权机制
 */
function checkAuth(req) {
  // 实际项目中应该从请求头或 cookie 中获取 token 进行验证
  // 这里简化处理，允许未登录用户访问配置（因为前端需要配置才能加载）
  return true;
}

/**
 * 获取高德地图配置（前端使用）
 * GET /api/config/amap
 * 
 * 返回前端所需的非敏感配置：
 * - key: 高德 Web 服务 Key（前端地图显示需要）
 * - securityJsCode: 前端安全密钥（用于高德 JS API 安全密钥配置）
 * 
 * 注意：后端安全密钥（AMAP_SECURITY_JSCODE）不会返回给前端
 */
router.get('/amap', (req, res) => {
  try {
    // 简单鉴权检查（可选，可根据需要开启）
    // if (!checkAuth(req)) {
    //   return res.json({
    //     code: 1,
    //     data: null,
    //     msg: '请先登录'
    //   });
    // }

    const config = getConfig();

    if (!config.key) {
      return res.json({
        code: 1,
        data: null,
        msg: '高德配置未完成：请在 .env 文件中配置 AMAP_KEY'
      });
    }

    // 获取前端安全密钥
    const securityJsCode = process.env.AMAP_FRONT_SECURITY_JSCODE || '';
    
    // 如果未配置前端安全密钥，在响应中提示
    if (!securityJsCode) {
      console.warn('⚠️  高德前端安全密钥未配置：请在 .env 文件中配置 AMAP_FRONT_SECURITY_JSCODE 以支持前端地图功能');
    }
    
    // 返回前端配置（不包含后端安全密钥）
    res.json({
      code: 0,
      data: {
        key: config.key,
        // 前端安全密钥（如果配置了）
        securityJsCode: securityJsCode,
        apiDomain: config.apiDomain
      },
      msg: securityJsCode ? '获取成功' : '获取成功（提示：请配置 AMAP_FRONT_SECURITY_JSCODE 以支持前端地图功能）'
    });
  } catch (error) {
    console.error('获取高德配置错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '获取配置失败'
    });
  }
});

/**
 * 测试接口：返回当前高德配置（脱敏展示，仅用于调试）
 * GET /api/config/test
 * 
 * 注意：此接口仅用于开发调试，生产环境应移除或添加严格权限控制
 */
router.get('/test', (req, res) => {
  try {
    const config = getConfig();

    // 脱敏展示配置信息
    const maskedKey = config.key ? `${config.key.substring(0, 8)}****${config.key.substring(config.key.length - 4)}` : '未配置';
    
    res.json({
      code: 0,
      data: {
        key: maskedKey,
        hasSecurityJsCode: config.hasSecurityJsCode ? '已配置' : '未配置',
        hasFrontSecurityJsCode: !!process.env.AMAP_FRONT_SECURITY_JSCODE,
        apiDomain: config.apiDomain
      },
      msg: '配置信息（已脱敏）'
    });
  } catch (error) {
    console.error('获取配置测试信息错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '获取失败'
    });
  }
});

module.exports = router;

