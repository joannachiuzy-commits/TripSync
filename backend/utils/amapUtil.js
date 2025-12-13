/**
 * 高德地图 API 工具
 * 封装高德地图 API 请求，用于路线规划
 * 
 * 配置说明：
 * - 所有高德相关配置均从 .env 文件中读取
 * - 禁止在代码中硬编码密钥
 * - AMAP_KEY: 高德 Web 服务 Key（必填）
 * - AMAP_SECURITY_JSCODE: 高德安全密钥（可选，用于 Web 服务 API）
 * - AMAP_API_DOMAIN: 高德 API 域名（可选，默认 https://restapi.amap.com）
 */

const axios = require('axios');
const crypto = require('crypto');

// 从环境变量读取配置
const AMAP_KEY = process.env.AMAP_KEY;
const AMAP_SECURITY_JSCODE = process.env.AMAP_SECURITY_JSCODE;
const AMAP_API_DOMAIN = process.env.AMAP_API_DOMAIN || 'https://restapi.amap.com';
const AMAP_API_BASE = `${AMAP_API_DOMAIN}/v3`;

/**
 * 验证高德配置是否完整
 * @throws {Error} 如果必需配置缺失
 */
function validateConfig() {
  if (!AMAP_KEY) {
    throw new Error('高德配置错误：AMAP_KEY 未配置，请在 .env 文件中设置');
  }
  
  // 提示用户确保AMAP_KEY类型为「Web服务」
  console.log('📌 高德地图配置提示：请确保 AMAP_KEY 为「Web 服务」类型（获取地址：https://console.amap.com/dev/key/app）');
}

/**
 * 处理高德API错误，返回友好的错误信息
 * @param {Error|string} error 错误对象或错误信息
 * @returns {Error} 格式化后的错误对象
 */
function handleAMapError(error) {
  const errorMessage = error.message || error.toString() || '';
  const errorInfo = error.response?.data?.info || errorMessage;
  
  // 检查常见的高德API错误码
  if (errorInfo.includes('USERKEY_PLAT_NOMATCH')) {
    return new Error('高德密钥类型不匹配，请将AMAP_KEY更换为「Web服务」类型（获取地址：https://console.amap.com/dev/key/app）');
  }
  
  if (errorInfo.includes('INVALID_USER_SCODE')) {
    return new Error('高德前端安全密钥无效，请检查AMAP_FRONT_SECURITY_JSCODE配置');
  }
  
  if (errorInfo.includes('INVALID_USER_KEY')) {
    return new Error('高德密钥无效，请检查AMAP_KEY配置是否正确');
  }
  
  // 返回原始错误信息
  return new Error(errorInfo || '高德API调用失败');
}

/**
 * 生成高德 API 签名（如果配置了安全密钥）
 * @param {Object} params 请求参数
 * @returns {Object} 包含签名的参数对象
 */
function addSignature(params) {
  if (!AMAP_SECURITY_JSCODE) {
    return params;
  }

  // 高德安全密钥签名规则
  const keys = Object.keys(params).sort();
  const queryString = keys.map(key => `${key}=${params[key]}`).join('&');
  const signature = crypto
    .createHash('md5')
    .update(queryString + AMAP_SECURITY_JSCODE)
    .digest('hex');

  return {
    ...params,
    sig: signature
  };
}

/**
 * 路线规划（驾车、步行、公交）
 * @param {string} origin 起点坐标（格式：经度,纬度）
 * @param {string} destination 终点坐标（格式：经度,纬度）
 * @param {Array<string>} waypoints 途径点坐标数组（可选）
 * @param {string} strategy 路线策略：0-速度优先，1-费用优先，2-距离优先，3-不走高速，4-躲避拥堵（默认）
 * @returns {Promise<Object>} 路线规划结果
 */
async function planRoute(origin, destination, waypoints = [], strategy = '4') {
  validateConfig();

  try {
    // 构建途径点字符串
    let waypointsStr = '';
    if (waypoints.length > 0) {
      waypointsStr = waypoints.join('|');
    }

    const url = `${AMAP_API_BASE}/direction/driving`;
    let params = {
      key: AMAP_KEY,
      origin,
      destination,
      strategy,
      extensions: 'all' // 返回详细信息
    };

    if (waypointsStr) {
      params.waypoints = waypointsStr;
    }

    // 添加签名（如果配置了安全密钥）
    params = addSignature(params);

    const response = await axios.get(url, { params });

    if (response.data.status !== '1') {
      const error = new Error(response.data.info || '未知错误');
      throw handleAMapError(error);
    }

    const route = response.data.route;
    const paths = route.paths || [];

    // 格式化路线数据
    return {
      distance: paths[0]?.distance || 0, // 总距离（米）
      duration: paths[0]?.duration || 0, // 总时间（秒）
      tolls: paths[0]?.tolls || 0, // 过路费（元）
      tollDistance: paths[0]?.toll_distance || 0, // 收费路段距离（米）
      steps: paths[0]?.steps || [], // 路线步骤
      polyline: paths[0]?.polyline || '' // 路线坐标点（用于绘制）
    };
  } catch (error) {
    // 使用统一的错误处理函数
    throw handleAMapError(error);
  }
}

/**
 * 地理编码（地址转坐标）
 * @param {string} address 地址
 * @returns {Promise<Object>} { location: '经度,纬度', formatted_address: '格式化地址' }
 */
async function geocode(address) {
  validateConfig();

  try {
    const url = `${AMAP_API_BASE}/geocode/geo`;
    let params = {
      key: AMAP_KEY,
      address
    };

    // 添加签名（如果配置了安全密钥）
    params = addSignature(params);

    const response = await axios.get(url, { params });

    if (response.data.status !== '1') {
      const error = new Error(response.data.info || '未知错误');
      throw handleAMapError(error);
    }

    const geocodes = response.data.geocodes || [];
    if (geocodes.length === 0) {
      throw new Error('未找到该地址的坐标');
    }

    return {
      location: geocodes[0].location, // 格式：经度,纬度
      formatted_address: geocodes[0].formatted_address
    };
  } catch (error) {
    // 使用统一的错误处理函数
    throw handleAMapError(error);
  }
}

/**
 * 逆地理编码（坐标转地址）
 * @param {string} location 坐标（格式：经度,纬度）
 * @returns {Promise<Object>} { formatted_address: '格式化地址', ... }
 */
async function reverseGeocode(location) {
  validateConfig();

  try {
    const url = `${AMAP_API_BASE}/geocode/regeo`;
    let params = {
      key: AMAP_KEY,
      location
    };

    // 添加签名（如果配置了安全密钥）
    params = addSignature(params);

    const response = await axios.get(url, { params });

    if (response.data.status !== '1') {
      const error = new Error(response.data.info || '未知错误');
      throw handleAMapError(error);
    }

    const regeocode = response.data.regeocode || {};
    return {
      formatted_address: regeocode.formatted_address || '',
      addressComponent: regeocode.addressComponent || {}
    };
  } catch (error) {
    // 使用统一的错误处理函数
    throw handleAMapError(error);
  }
}

/**
 * 获取高德配置（用于配置接口，不返回敏感信息）
 * @returns {Object} 配置信息
 */
function getConfig() {
  return {
    key: AMAP_KEY,
    hasSecurityJsCode: !!AMAP_SECURITY_JSCODE,
    apiDomain: AMAP_API_DOMAIN
  };
}

module.exports = {
  planRoute,
  geocode,
  reverseGeocode,
  getConfig,
  validateConfig,
  handleAMapError
};

