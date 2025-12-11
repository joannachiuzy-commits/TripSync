/**
 * 统一请求工具
 * 封装 axios 基础配置（基础 URL、超时、统一错误拦截）
 * 【优化】所有组件替换直接使用 axios 的代码，改用 request.js
 */

import axios from 'axios'
import { API_BASE_URL, API_TIMEOUT } from '../config/index.js'

// 创建 axios 实例
const request = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT.default,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 可以在这里添加token等认证信息
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`
    // }
    return config
  },
  (error) => {
    console.error('请求拦截器错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器 - 统一错误处理
request.interceptors.response.use(
  (response) => {
    // 统一处理后端返回格式：{ code: 200, data: {...}, msg: "成功" }
    const { data } = response
    
    // 如果后端返回统一格式，直接返回data字段
    if (data && typeof data === 'object' && 'code' in data) {
      // 成功响应
      if (data.code === 200) {
        return data
      } else {
        // 业务错误（如参数验证失败）
        const error = new Error(data.msg || '请求失败')
        error.code = data.code
        error.data = data.data
        return Promise.reject(error)
      }
    }
    
    // 兼容旧格式（直接返回数据）
    return data
  },
  (error) => {
    // 统一错误处理
    let errorMessage = '请求失败'
    
    if (error.response) {
      // 服务器返回了错误响应
      const { status, data } = error.response
      
      if (data && typeof data === 'object') {
        // 后端统一错误格式：{ code: 500, msg: "...", error: "..." }
        if (data.msg) {
          errorMessage = data.msg
        } else if (data.error) {
          errorMessage = data.error
        } else if (data.details) {
          errorMessage = data.details
        } else {
          errorMessage = `服务器错误 (${status})`
        }
      } else {
        errorMessage = `服务器错误 (${status})`
      }
      
      // HTTP状态码错误处理
      switch (status) {
        case 400:
          errorMessage = data?.msg || data?.error || '请求参数错误'
          break
        case 401:
          errorMessage = '未授权，请先登录'
          break
        case 403:
          errorMessage = '禁止访问'
          break
        case 404:
          errorMessage = data?.msg || data?.error || '资源不存在'
          break
        case 500:
          errorMessage = data?.msg || data?.error || '服务器内部错误'
          break
        default:
          errorMessage = data?.msg || data?.error || `服务器错误 (${status})`
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorMessage = '请求超时，请稍后重试'
      } else {
        errorMessage = '无法连接到服务器，请检查网络或确保后端服务正在运行'
      }
    } else {
      // 请求配置错误
      errorMessage = error.message || '请求配置错误'
    }
    
    // 创建统一的错误对象
    const unifiedError = new Error(errorMessage)
    unifiedError.originalError = error
    unifiedError.status = error.response?.status
    unifiedError.code = error.response?.data?.code
    
    console.error('请求错误:', unifiedError.message, error)
    
    return Promise.reject(unifiedError)
  }
)

/**
 * GET 请求
 * @param {string} url - 请求URL（相对于baseURL）
 * @param {object} params - 查询参数
 * @param {object} config - 额外配置（如timeout）
 */
export const get = (url, params = {}, config = {}) => {
  return request.get(url, {
    params,
    ...config
  })
}

/**
 * POST 请求
 * @param {string} url - 请求URL（相对于baseURL）
 * @param {object} data - 请求体数据
 * @param {object} config - 额外配置（如timeout）
 */
export const post = (url, data = {}, config = {}) => {
  return request.post(url, data, config)
}

/**
 * PUT 请求
 * @param {string} url - 请求URL（相对于baseURL）
 * @param {object} data - 请求体数据
 * @param {object} config - 额外配置（如timeout）
 */
export const put = (url, data = {}, config = {}) => {
  return request.put(url, data, config)
}

/**
 * DELETE 请求
 * @param {string} url - 请求URL（相对于baseURL）
 * @param {object} config - 额外配置（如timeout）
 */
export const del = (url, config = {}) => {
  return request.delete(url, config)
}

// 导出默认实例（用于需要自定义配置的场景）
export default request


