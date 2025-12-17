/**
 * 请求处理工具函数
 * 提供通用的请求处理方法，避免代码重复
 */

/**
 * 获取用户ID（支持userId和guestId）
 * 从请求的body或query参数中提取用户ID
 * @param {Object} req Express请求对象
 * @returns {string|null} 用户ID，如果不存在则返回null
 */
function getUserId(req) {
  return req.body.userId || req.body.guestId || req.query.userId || req.query.guestId || null;
}

module.exports = {
  getUserId
};

