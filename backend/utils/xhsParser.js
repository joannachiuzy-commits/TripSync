/**
 * 小红书解析工具函数
 * 拆分 parseXhsPage 函数，将登录检测、内容过滤、HTML 提取拆为独立函数
 */

/**
 * 检测页面是否包含登录提示
 * @param {string} pageContent - 页面HTML内容
 * @returns {boolean} 是否包含登录提示
 */
export const hasLoginPrompt = (pageContent) => {
  if (!pageContent) return false
  
  const loginIndicators = [
    '登录后推荐',
    '登录查看更多',
    '请先登录',
    '登录后查看',
    '需要登录',
    '登录以继续',
    'sign in',
    'login'
  ]
  
  const lowerContent = pageContent.toLowerCase()
  return loginIndicators.some(indicator => lowerContent.includes(indicator.toLowerCase()))
}

/**
 * 检测内容是否包含无关信息（评论/推荐等）
 * @param {string} content - 内容文本
 * @returns {boolean} 是否包含无关信息
 */
export const hasUnrelatedContent = (content) => {
  if (!content) return false
  
  // 明确的评论/推荐标识
  const unrelatedPatterns = [
    /11-\d{2}/,           // 日期格式（如 11-30）
    /\d+\.\d+w/,          // 数字.w格式（如 942.8w）
    /评论/,                // 评论
    /推荐/,                // 推荐
    /查看更多/,            // 查看更多
    /相关推荐/,            // 相关推荐
    /热门评论/             // 热门评论
  ]
  
  return unrelatedPatterns.some(pattern => pattern.test(content))
}

/**
 * 过滤无关内容
 * @param {string} content - 原始内容
 * @returns {string} 过滤后的内容
 */
export const filterUnrelatedContent = (content) => {
  if (!content) return ''
  
  // 如果内容包含明确的无关信息标识，尝试过滤
  if (hasUnrelatedContent(content)) {
    // 简单的过滤：移除包含无关标识的行
    const lines = content.split('\n')
    const filteredLines = lines.filter(line => {
      const lowerLine = line.toLowerCase()
      return !(
        lowerLine.includes('11-') ||
        lowerLine.includes('.w') ||
        lowerLine.includes('评论') ||
        lowerLine.includes('推荐')
      )
    })
    return filteredLines.join('\n').trim()
  }
  
  return content
}

/**
 * 从页面HTML中提取文本内容
 * @param {object} page - Puppeteer页面对象
 * @returns {Promise<object>} 包含title, description, keywordsMeta, textContent, rawContent的对象
 */
export const extractPageContent = async (page) => {
  return await page.evaluate(() => {
    // 提取 og:title
    const ogTitleElement = document.querySelector('meta[property="og:title"]')
    const title = ogTitleElement ? ogTitleElement.getAttribute('content') : ''
    
    // 提取 og:description
    const ogDescElement = document.querySelector('meta[property="og:description"]')
    const description = ogDescElement ? ogDescElement.getAttribute('content') : ''
    
    // 提取 keywords
    const keywordsElement = document.querySelector('meta[name="keywords"]')
    const keywordsMeta = keywordsElement ? keywordsElement.getAttribute('content') : ''
    
    // 尝试从笔记标题元素提取
    let noteTitle = ''
    const titleSelectors = [
      '.note-title',
      '[class*="title"]',
      'h1',
      'h2',
      '.title',
      '[data-v-] h1',
      '[data-v-] h2'
    ]
    for (const selector of titleSelectors) {
      const titleEl = document.querySelector(selector)
      if (titleEl && titleEl.textContent && titleEl.textContent.trim().length > 0) {
        noteTitle = titleEl.textContent.trim()
        break
      }
    }
    
    // 提取内容
    let textContent = ''
    let rawContent = ''
    
    const noteContentSelectors = [
      '.note-content',
      '.content',
      '[class*="note-content"]',
      '[class*="noteContent"]',
      'article',
      '[class*="desc"]',
      '[class*="text"]',
      'main'
    ]
    
    let noteMainContent = null
    for (const selector of noteContentSelectors) {
      const elements = document.querySelectorAll(selector)
      for (const el of elements) {
        if (el && el.textContent && el.textContent.trim().length > 20) {
          noteMainContent = el
          break
        }
      }
      if (noteMainContent) break
    }
    
    if (noteMainContent) {
      textContent = noteMainContent.innerText || noteMainContent.textContent || ''
      rawContent = textContent
    } else {
      if (document.body) {
        textContent = document.body.innerText || document.body.textContent || ''
        rawContent = textContent
      }
    }
    
    // 如果都没有，使用描述或标题
    if (!rawContent || rawContent.length < 5) {
      if (description && description.trim().length > 10) {
        rawContent = description
        textContent = description
      } else if (title) {
        rawContent = title
        textContent = title
      }
    }
    
    return {
      title: noteTitle || title,
      description,
      keywordsMeta,
      textContent: textContent || '',
      rawContent: rawContent || ''
    }
  })
}

/**
 * 获取随机User-Agent
 * @returns {string} 随机User-Agent字符串
 */
export const getRandomUserAgent = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
  ]
  return userAgents[Math.floor(Math.random() * userAgents.length)]
}

/**
 * 移动端User-Agent
 */
export const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'

