/**
 * 前端工具函数
 * 提供通用的工具方法，避免代码重复
 */

/**
 * 转义HTML特殊字符，防止XSS攻击
 * @param {string} text 要转义的文本
 * @returns {string} 转义后的HTML字符串
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 导出工具函数
window.utils = {
  escapeHtml
};

