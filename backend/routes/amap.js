/**
 * 高德地图 API 路由
 * 处理路线规划相关请求
 */

const express = require('express');
const router = express.Router();
const { planRoute, geocode, reverseGeocode } = require('../utils/amapUtil');

/**
 * 路线规划
 * POST /api/amap/route
 * Body: { origin, destination, waypoints?, strategy? }
 */
router.post('/route', async (req, res) => {
  try {
    const { origin, destination, waypoints, strategy } = req.body;

    if (!origin || !destination) {
      return res.json({
        code: 1,
        data: null,
        msg: '起点和终点不能为空'
      });
    }

    // 调用高德 API 进行路线规划
    const route = await planRoute(origin, destination, waypoints || [], strategy || '4');

    res.json({
      code: 0,
      data: {
        route
      },
      msg: '规划成功'
    });
  } catch (error) {
    console.error('路线规划错误:', error);
    
    // 检查是否为高德API特定错误
    const errorMessage = error.message || '路线规划失败';
    let statusCode = 200; // 保持原有响应格式
    
    // 如果是密钥相关错误，返回更明确的提示
    if (errorMessage.includes('密钥类型不匹配') || errorMessage.includes('USERKEY_PLAT_NOMATCH')) {
      statusCode = 400;
    }
    
    res.status(statusCode).json({
      code: 1,
      data: null,
      msg: errorMessage
    });
  }
});

/**
 * 地理编码（地址转坐标）
 * POST /api/amap/geocode
 * Body: { address }
 */
router.post('/geocode', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.json({
        code: 1,
        data: null,
        msg: '地址不能为空'
      });
    }

    const result = await geocode(address);

    res.json({
      code: 0,
      data: result,
      msg: '编码成功'
    });
  } catch (error) {
    console.error('地理编码错误:', error);
    
    const errorMessage = error.message || '地理编码失败';
    let statusCode = 200;
    
    if (errorMessage.includes('密钥类型不匹配') || errorMessage.includes('USERKEY_PLAT_NOMATCH')) {
      statusCode = 400;
    }
    
    res.status(statusCode).json({
      code: 1,
      data: null,
      msg: errorMessage
    });
  }
});

/**
 * 逆地理编码（坐标转地址）
 * POST /api/amap/reverse-geocode
 * Body: { location }
 */
router.post('/reverse-geocode', async (req, res) => {
  try {
    const { location } = req.body;

    if (!location) {
      return res.json({
        code: 1,
        data: null,
        msg: '坐标不能为空'
      });
    }

    const result = await reverseGeocode(location);

    res.json({
      code: 0,
      data: result,
      msg: '逆编码成功'
    });
  } catch (error) {
    console.error('逆地理编码错误:', error);
    
    const errorMessage = error.message || '逆地理编码失败';
    let statusCode = 200;
    
    if (errorMessage.includes('密钥类型不匹配') || errorMessage.includes('USERKEY_PLAT_NOMATCH')) {
      statusCode = 400;
    }
    
    res.status(statusCode).json({
      code: 1,
      data: null,
      msg: errorMessage
    });
  }
});

module.exports = router;

