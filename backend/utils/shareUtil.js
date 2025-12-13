/**
 * 协作分享工具
 * 生成和验证分享链接
 */

const crypto = require('crypto');

/**
 * 生成分享链接
 * @param {string} tripId 行程ID
 * @param {string} permission 权限：'edit' 或 'read'
 * @returns {string} 分享链接（格式：tripId_permission_randomString）
 */
function generateShareLink(tripId, permission) {
  // 生成随机字符串（8位）
  const randomString = crypto.randomBytes(4).toString('hex');
  
  // 组合：tripId_permission_randomString
  const shareLink = `${tripId}_${permission}_${randomString}`;
  
  return shareLink;
}

/**
 * 验证分享链接
 * @param {string} shareLink 分享链接
 * @returns {Object|null} { tripId, permission } 或 null（无效链接）
 */
function verifyShareLink(shareLink) {
  try {
    const parts = shareLink.split('_');
    
    // 格式：tripId_permission_randomString（至少3部分）
    if (parts.length < 3) {
      return null;
    }
    
    const permission = parts[parts.length - 2]; // 倒数第二部分是权限
    
    if (permission !== 'edit' && permission !== 'read') {
      return null;
    }
    
    // tripId 是前面所有部分（除了最后两部分：permission 和 randomString）
    const tripId = parts.slice(0, -2).join('_');
    
    return {
      tripId,
      permission
    };
  } catch (error) {
    return null;
  }
}

module.exports = {
  generateShareLink,
  verifyShareLink
};

