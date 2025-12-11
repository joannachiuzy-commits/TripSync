/**
 * 全局配置文件
 * 集中管理后端地址、地图默认配置等
 * 【优化】删除所有组件中硬编码的「http://localhost:3008」
 */

// 后端API基础地址
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3008'

// 地图默认配置
export const MAP_CONFIG = {
  // 默认中心点（北京）
  defaultCenter: {
    lng: 116.403963,
    lat: 39.915119
  },
  // 默认缩放级别
  defaultZoom: 13,
  // 选中位置后的缩放级别
  selectedZoom: 15,
  // 容器最小尺寸
  containerMinSize: {
    width: 800,
    height: 600
  }
}

// API超时配置（毫秒）
export const API_TIMEOUT = {
  default: 10000,      // 默认10秒
  map: 5000,           // 地图相关接口5秒
  parse: 120000        // 解析接口120秒（小红书解析可能需要较长时间）
}

// 请求重试配置
export const RETRY_CONFIG = {
  maxRetries: 3,       // 最大重试次数
  retryDelay: 1000    // 重试延迟（毫秒）
}


