/**
 * 地图API路由
 * 提供地图API Key获取接口
 * 【优化】使用统一的mapKey工具函数和错误处理中间件
 */

import express from 'express'
import { getMapKeys } from '../utils/mapKey.js'
import { asyncHandler, successResponse, errorResponse } from '../utils/errorHandler.js'

const router = express.Router()

/**
 * GET /api/map/key
 * 获取地图API Keys（高德和Google）
 * 返回格式：
 * {
 *   "code": 200,
 *   "data": {
 *     "amap": "你的高德Key",
 *     "google": "你的Google Key"
 *   },
 *   "msg": "成功"
 * }
 */
router.get('/key', asyncHandler(async (req, res) => {
  // 【优化】使用统一的mapKey工具函数
  const keys = getMapKeys()
  
  // 【优化】添加调试日志
  console.log('🔑 [GET /api/map/key] 读取环境变量:')
  console.log('   - AMAP_API_KEY存在:', !!keys.amap)
  console.log('   - AMAP_API_KEY值:', keys.amap ? keys.amap.substring(0, 10) + '...' : 'null')
  console.log('   - GOOGLE_API_KEY存在:', !!keys.google)
  console.log('🔑 [GET /api/map/key] 返回结果:')
  console.log('   - amap:', keys.amap ? keys.amap.substring(0, 10) + '...' : 'null')
  console.log('   - google:', keys.google ? '已配置' : 'null')
  
  // 【优化】使用统一的成功响应格式
  return res.json(successResponse(keys, '成功'))
}))

export default router

