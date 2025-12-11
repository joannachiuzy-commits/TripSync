/**
 * 地图API Key工具函数
 * 统一读取 AMAP_API_KEY/GOOGLE_API_KEY 环境变量
 * 删除 map.js 和 server.js 中重复的配置读取代码
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量（从backend目录加载.env文件）
dotenv.config({ path: path.resolve(__dirname, '../.env') })

/**
 * 获取高德地图API Key
 * @returns {string|null} 高德地图API Key，如果未配置或为占位符则返回null
 */
export const getAmapKey = () => {
  const AMAP_API_KEY = process.env.AMAP_API_KEY || process.env.VITE_AMAP_API_KEY || null
  
  // 过滤占位符
  if (AMAP_API_KEY && AMAP_API_KEY !== 'YOUR_AMAP_API_KEY') {
    return AMAP_API_KEY
  }
  
  return null
}

/**
 * 获取Google地图API Key
 * @returns {string|null} Google地图API Key，如果未配置或为占位符则返回null
 */
export const getGoogleKey = () => {
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY || null
  
  // 过滤占位符
  if (GOOGLE_API_KEY && GOOGLE_API_KEY !== 'YOUR_GOOGLE_API_KEY') {
    return GOOGLE_API_KEY
  }
  
  return null
}

/**
 * 获取所有地图API Keys
 * @returns {{amap: string|null, google: string|null}} 包含高德和Google地图Key的对象
 */
export const getMapKeys = () => {
  return {
    amap: getAmapKey(),
    google: getGoogleKey()
  }
}

/**
 * 检查地图Key是否已配置
 * @param {string} type - 地图类型 ('amap' | 'google')
 * @returns {boolean} 是否已配置
 */
export const isMapKeyConfigured = (type = 'amap') => {
  if (type === 'amap') {
    return getAmapKey() !== null
  } else if (type === 'google') {
    return getGoogleKey() !== null
  }
  return false
}

