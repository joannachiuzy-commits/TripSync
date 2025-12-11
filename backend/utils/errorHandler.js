/**
 * 统一错误处理中间件
 * 替代所有接口内重复的 try-catch 代码
 * 统一返回格式: { code: xx, msg: xx, error: xx }
 */

/**
 * 错误处理中间件
 * 使用方式: app.use(errorHandler)
 * 或者在路由中使用: router.use(errorHandler)
 */
export const errorHandler = (err, req, res, next) => {
  console.error('❌ [ErrorHandler] 服务器错误:', err)
  
  // 默认错误信息
  let code = 500
  let msg = '服务器内部错误'
  let error = err.message || '未知错误'
  
  // 根据错误类型设置不同的错误码和消息
  if (err.statusCode) {
    code = err.statusCode
  } else if (err.status) {
    code = err.status
  }
  
  // 自定义错误消息
  if (err.message) {
    // 如果是业务错误（如参数验证失败），使用400状态码
    if (err.message.includes('必填') || err.message.includes('参数') || err.message.includes('无效')) {
      code = 400
      msg = err.message
    } else if (err.message.includes('不存在') || err.message.includes('未找到')) {
      code = 404
      msg = err.message
    } else {
      msg = err.message
    }
  }
  
  // 统一返回格式
  return res.status(code).json({
    code,
    msg,
    error: process.env.NODE_ENV === 'production' ? undefined : error, // 生产环境不暴露详细错误
    ...(err.data !== undefined && { data: err.data }) // 如果有data字段，也返回
  })
}

/**
 * 异步错误处理包装器
 * 使用方式: app.get('/api/xxx', asyncHandler(async (req, res) => { ... }))
 * 自动捕获异步函数中的错误并传递给错误处理中间件
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * 创建标准成功响应
 * @param {*} data - 响应数据
 * @param {string} msg - 成功消息
 * @param {number} code - 状态码（默认200）
 */
export const successResponse = (data = null, msg = '成功', code = 200) => {
  return {
    code,
    data,
    msg
  }
}

/**
 * 创建标准错误响应
 * @param {string} msg - 错误消息
 * @param {number} code - 状态码（默认500）
 * @param {string} error - 详细错误信息
 */
export const errorResponse = (msg = '服务器内部错误', code = 500, error = null) => {
  return {
    code,
    msg,
    ...(error && { error })
  }
}

