import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// 【修复2】安全导入supabase，避免配置错误导致服务器无法启动
// 使用try-catch包裹导入，如果失败则supabase为null，后续使用JSON文件存储
let supabase = null
try {
  const { supabase: supabaseClient } = await import('./config/supabase.js')
  supabase = supabaseClient || null
  if (supabase) {
    console.log('✅ Supabase配置加载成功')
  }
} catch (supabaseError) {
  // 如果导入失败（比如配置错误、语法错误等），继续运行，使用JSON文件存储
  console.warn('⚠️ Supabase配置导入失败，将使用JSON文件存储:', supabaseError.message)
  supabase = null
}

// 获取当前文件目录（ES模块）
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config()

// 创建Express应用
const app = express()
const PORT = 3008

// 【修复3】中间件配置 - 确保顺序正确
app.use(cors()) // 允许跨域请求
app.use(express.json()) // 解析JSON请求体
app.use(express.urlencoded({ extended: true })) // 解析URL编码的请求体



// ==================== 路由定义 ====================

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TripSync后端服务运行正常' })
})

// 【修复1】测试接口 - 用于验证服务器是否正常启动
app.get('/api/test', (req, res) => {
  res.json({ message: '后端接口正常' })
})

// ==================== 攻略CRUD接口 ====================

// 获取所有攻略 (GET /api/guides)
app.get('/api/guides', async (req, res) => {
  try {
    let guidesData = []
    
    // 【统一修复1】检查supabase是否可用，并处理连接失败的情况
    if (supabase && isSupabaseConfigured()) {
      try {
        // 从Supabase查询所有攻略
        const { data, error } = await supabase
          .from('guides')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          console.warn('⚠️ Supabase查询攻略失败，返回空数组:', error.message)
          guidesData = []
        } else {
          guidesData = data || []
        }
      } catch (dbError) {
        // Supabase连接失败或其他错误，返回空数组
        console.warn('⚠️ Supabase连接失败，返回空数组:', dbError.message)
        guidesData = []
      }
    } else {
      // Supabase未配置，返回空数组
      console.log('ℹ️ Supabase未配置，返回空数组')
      guidesData = []
    }
    
    // 【统一修复2】统一返回格式：{ code: 200, data: [...], msg: "成功" }
    return res.json({
      code: 200,
      data: guidesData,
      msg: '成功'
    })
  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ 
      code: 500,
      data: [],
      msg: '服务器内部错误',
      error: err.message 
    })
  }
})

// 根据ID获取单个攻略 (GET /api/guides/:id)
app.get('/api/guides/:id', async (req, res) => {
  try {
    const { id } = req.params

    // 从Supabase查询指定ID的攻略
    const { data, error } = await supabase
      .from('guides')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('查询攻略失败:', error)
      return res.status(404).json({ error: '攻略不存在', details: error.message })
    }

    res.json(data)
  } catch (err) {
    console.error('服务器错误:', err)
    res.status(500).json({ error: '服务器内部错误', details: err.message })
  }
})

// 创建新攻略 (POST /api/guides)
app.post('/api/guides', async (req, res) => {
  try {
    const { title, description, location, content } = req.body

    // 验证必填字段
    if (!title || !description || !location) {
      return res.status(400).json({ error: '标题、描述和地点为必填项' })
    }

    // 插入新攻略到Supabase
    const { data, error } = await supabase
      .from('guides')
      .insert([
        {
          title,
          description,
          location,
          content: content || '',
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('创建攻略失败:', error)
      return res.status(500).json({ error: '创建攻略失败', details: error.message })
    }

    res.status(201).json(data)
  } catch (err) {
    console.error('服务器错误:', err)
    res.status(500).json({ error: '服务器内部错误', details: err.message })
  }
})

// 更新攻略 (PUT /api/guides/:id)
app.put('/api/guides/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { title, description, location, content } = req.body

    // 构建更新对象（只包含提供的字段）
    const updates = {}
    if (title) updates.title = title
    if (description) updates.description = description
    if (location) updates.location = location
    if (content !== undefined) updates.content = content
    updates.updated_at = new Date().toISOString()

    // 更新Supabase中的攻略
    const { data, error } = await supabase
      .from('guides')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('更新攻略失败:', error)
      return res.status(500).json({ error: '更新攻略失败', details: error.message })
    }

    if (!data) {
      return res.status(404).json({ error: '攻略不存在' })
    }

    res.json(data)
  } catch (err) {
    console.error('服务器错误:', err)
    res.status(500).json({ error: '服务器内部错误', details: err.message })
  }
})

// 删除攻略 (DELETE /api/guides/:id)
app.delete('/api/guides/:id', async (req, res) => {
  try {
    const { id } = req.params

    // 从Supabase删除攻略
    const { error } = await supabase
      .from('guides')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('删除攻略失败:', error)
      return res.status(500).json({ error: '删除攻略失败', details: error.message })
    }

    res.json({ message: '攻略删除成功' })
  } catch (err) {
    console.error('服务器错误:', err)
    res.status(500).json({ error: '服务器内部错误', details: err.message })
  }
})

// ==================== 小红书链接解析接口 ====================

// 【优化1】强化请求头，模拟真实浏览器
const XHS_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  Referer: 'https://www.xiaohongshu.com/',
  'Cache-Control': 'max-age=0',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  Cookie: '' // 可留空或加基础值
}

// 【优化2】移动端User-Agent（用于检测到登录提示时切换）
const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'

// 从HTML中提取字段的辅助方法（正则兜底）
const pickByRegex = (html = '', patterns = []) => {
  for (const reg of patterns) {
    const match = html.match(reg)
    if (match && match[1]) return match[1].trim()
  }
  return ''
}

/**
 * 生成随机 User-Agent（模拟不同浏览器）
 * @returns {string} 随机 User-Agent 字符串
 */
const getRandomUserAgent = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  ]
  return userAgents[Math.floor(Math.random() * userAgents.length)]
}

/**
 * 【优化3】检测页面是否包含登录提示
 * @param {string} htmlContent - HTML内容
 * @returns {boolean} 是否包含登录提示
 */
const hasLoginPrompt = (htmlContent) => {
  if (!htmlContent) return true
  
  const loginKeywords = [
    '登录后推荐',
    '登录查看更多',
    '请先登录',
    '登录后查看',
    '立即登录',
    '登录/注册',
    '登录账号',
    '登录小红书',
    'login',
    'sign in'
  ]
  
  const lowerContent = htmlContent.toLowerCase()
  return loginKeywords.some(keyword => lowerContent.includes(keyword.toLowerCase()))
}

/**
 * 【优化9-修复】检测内容是否包含评论/推荐等无关信息（只检测明确的标识，不误过滤正文）
 * @param {string} content - 内容文本
 * @returns {boolean} 是否包含无关信息
 */
const hasUnrelatedContent = (content) => {
  if (!content) return false
  
  const lowerContent = content.toLowerCase()
  
  // 【修复1】只检测明确的评论/推荐标识，不再笼统过滤
  // 明确的评论/推荐标识模式（必须同时满足多个条件才判定为无关）
  const explicitUnrelatedPatterns = [
    /评论\s*\d+/,                 // "评论 123"（明确的评论数）
    /点赞\s*\d+/,                 // "点赞 456"（明确的点赞数）
    /收藏\s*\d+/,                 // "收藏 789"（明确的收藏数）
    /分享\s*\d+/,                 // "分享 101"（明确的分享数）
    /查看更多$/,                  // "查看更多"（行尾）
    /相关推荐$/,                  // "相关推荐"（行尾）
    /热门评论$/,                  // "热门评论"（行尾）
    /推荐笔记$/,                  // "推荐笔记"（行尾）
    /你可能还喜欢$/,              // "你可能还喜欢"（行尾）
    /猜你喜欢$/,                  // "猜你喜欢"（行尾）
    /大家都在搜$/,                // "大家都在搜"（行尾）
    /热门话题$/,                  // "热门话题"（行尾）
  ]
  
  // 【修复2】明确的无关关键词（必须是完整的短语，避免误判）
  const explicitUnrelatedKeywords = [
    '登录后推荐',
    '登录查看更多',
    '相关推荐',
    '热门评论',
    '推荐笔记',
    '你可能还喜欢',
    '猜你喜欢',
    '大家都在搜',
    '热门话题',
    '查看更多',
    '朱元璋告御状',              // 明确的无关内容
    '水银体温计将禁产'            // 明确的无关内容
  ]
  
  // 检查是否包含明确的无关关键词（完整匹配）
  if (explicitUnrelatedKeywords.some(keyword => lowerContent.includes(keyword.toLowerCase()))) {
    return true
  }
  
  // 【修复3】检测明确的评论/推荐标识（如"11-30"、"942.8w"），但只在行首或独立行
  // 如果内容很短（少于30字符），且匹配评论数格式（如"11-30"），可能是评论数
  if (content.length < 30 && /^\d+-\d+$/.test(content.trim())) {
    return true
  }
  
  // 如果内容很短（少于30字符），且匹配浏览量格式（如"942.8w"），可能是浏览量
  if (content.length < 30 && /^\d+\.\d+[wk]$/.test(content.trim())) {
    return true
  }
  
  // 检查是否匹配明确的无关模式（行尾匹配，避免误判正文中的词汇）
  const patternMatches = explicitUnrelatedPatterns.filter(pattern => pattern.test(content))
  if (patternMatches.length > 0) {
    return true
  }
  
  return false
}

/**
 * 【优化10-修复】过滤内容中的评论/推荐等无关信息（只过滤明确的标识，保留正文）
 * @param {string} content - 原始内容
 * @returns {string} 过滤后的内容
 */
const filterUnrelatedContent = (content) => {
  if (!content) return ''
  
  // 按行分割内容
  const lines = content.split(/\n/)
  const filteredLines = []
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    
    // 跳过空行
    if (!trimmedLine) continue
    
    // 【修复4】只跳过明确的评论/推荐行（使用修复后的检测函数）
    if (hasUnrelatedContent(trimmedLine)) {
      continue
    }
    
    // 【修复5】只跳过明确的评论数格式（独立行，且长度很短）
    // 如"11-30"这样的独立行才过滤，不过滤正文中的"11-30号"等
    if (/^\d+-\d+$/.test(trimmedLine) && trimmedLine.length < 20) {
      continue
    }
    
    // 【修复6】只跳过明确的浏览量格式（独立行，且长度很短）
    // 如"942.8w"这样的独立行才过滤，不过滤正文中的其他数字
    if (/^\d+\.\d+[wk]$/.test(trimmedLine) && trimmedLine.length < 30) {
      continue
    }
    
    // 保留所有其他内容（包括包含特殊符号的正文）
    filteredLines.push(trimmedLine)
  }
  
  return filteredLines.join('\n').trim()
}

/**
 * 解析小红书页面的核心函数
 * @param {string} targetUrl - 目标URL
 * @returns {Promise<Object>} 解析结果
 */
const parseXhsPage = async (targetUrl) => {
  // 浏览器实例
  let browser = null
  let page = null

  try {
    // 步骤1: 启动 Puppeteer 浏览器（优化配置 + 无痕模式 + 防检测）
    browser = await puppeteer.launch({
      headless: true, // 无头模式
      args: [
        '--no-sandbox', // 避免权限问题
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // 避免内存问题
        '--incognito', // 【关键修改1】无痕模式（替代 createIncognitoBrowserContext）
        '--disable-blink-features=AutomationControlled', // 【关键修改2】防检测：隐藏自动化特征
        '--disable-features=IsolateOrigins,site-per-process', // 防检测
        '--disable-web-security', // 禁用Web安全（可选）
        '--disable-plugins', // 禁用插件
        '--disable-extensions', // 禁用扩展
        '--disable-gpu', // 禁用GPU加速
        '--disable-background-networking', // 禁用后台网络
        '--disable-background-timer-throttling', // 禁用后台定时器节流
        '--disable-renderer-backgrounding', // 禁用渲染器后台
        '--disable-features=TranslateUI', // 禁用翻译UI
        '--disable-ipc-flooding-protection', // 禁用IPC洪水保护
        '--disable-hang-monitor', // 禁用挂起监控
        '--disable-prompt-on-repost', // 禁用重新发布提示
        '--disable-sync', // 禁用同步
        '--metrics-recording-only', // 仅记录指标
        '--mute-audio', // 静音
        '--no-first-run', // 无首次运行
        '--safebrowsing-disable-auto-update', // 禁用安全浏览自动更新
        '--enable-automation', // 启用自动化（但会被防检测参数覆盖）
        '--password-store=basic', // 基本密码存储
        '--use-mock-keychain' // 使用模拟密钥链（Mac）
      ]
    })

    // 步骤2: 创建新页面（直接创建，无痕模式已在启动参数中设置）
    page = await browser.newPage()

    // 步骤3: 【关键修改3】设置随机 User-Agent，模拟不同浏览器
    const randomUserAgent = getRandomUserAgent()
    await page.setUserAgent(randomUserAgent)
    console.log(`🌐 使用 User-Agent: ${randomUserAgent.substring(0, 50)}...`)

    // 步骤4: 隐藏自动化特征（进一步防检测）
    await page.evaluateOnNewDocument(() => {
      // 隐藏 webdriver 属性
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      })
      
      // 修改 navigator.plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      })
      
      // 修改 navigator.languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en']
      })
      
      // 修改 chrome 对象
      window.chrome = {
        runtime: {}
      }
    })

    // 步骤5: 【关键修改4】拦截资源请求，禁用图片/视频加载（加快速度）
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      const resourceType = request.resourceType()
      const url = request.url()
      
      // 阻止图片加载（加快速度，og:image 在 meta 标签中，不需要实际加载图片）
      if (resourceType === 'image') {
        request.abort()
      }
      // 阻止视频加载（加快速度）
      else if (resourceType === 'media' || resourceType === 'video') {
        request.abort()
      }
      // 阻止字体加载（可选，加快速度）
      else if (resourceType === 'font') {
        request.abort()
      }
      // 允许其他请求继续（包括样式表，因为可能需要渲染页面结构）
      else {
        request.continue()
      }
    })

    // 步骤6: 【优化4】访问目标页面（60秒超时），设置请求头
    await page.setExtraHTTPHeaders({
      'Referer': 'https://www.xiaohongshu.com/',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    })
    
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded', // DOM内容加载完成即可，比 networkidle0 快很多
      timeout: 60000 // 60秒超时
    })
    
    // 步骤7: 【关键修改6】等待页面内容加载（使用 Promise，替代已废弃的 waitForTimeout）
    // 等待动态内容加载完成
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // 【优化5】检测页面是否包含登录提示
    const pageContent = await page.content()
    if (hasLoginPrompt(pageContent)) {
      console.warn('⚠️ 检测到登录提示，尝试切换移动端UA重试...')
      
      // 关闭当前页面，重新创建
      await page.close()
      page = await browser.newPage()
      
      // 切换为移动端User-Agent
      await page.setUserAgent(MOBILE_USER_AGENT)
      await page.setExtraHTTPHeaders({
        'Referer': 'https://www.xiaohongshu.com/',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      })
      
      // 重新访问页面
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })
      
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // 再次检测
      const retryContent = await page.content()
      if (hasLoginPrompt(retryContent)) {
        throw new Error('当前链接需要登录，无法解析，请尝试其他公开笔记链接')
      }
      
      console.log('✅ 使用移动端UA成功绕过登录提示')
    }

    // 步骤7: 【优化6】提取页面文字信息（标题、描述、原始文本内容等），优化选择器
    const pageData = await page.evaluate(() => {
      // 提取 og:title
      const ogTitleElement = document.querySelector('meta[property="og:title"]')
      const title = ogTitleElement ? ogTitleElement.getAttribute('content') : ''
      
      // 提取 og:description
      const ogDescElement = document.querySelector('meta[property="og:description"]')
      const description = ogDescElement ? ogDescElement.getAttribute('content') : ''
      
      // 提取 keywords
      const keywordsElement = document.querySelector('meta[name="keywords"]')
      const keywordsMeta = keywordsElement ? keywordsElement.getAttribute('content') : ''
      
      // 【优化6-1】尝试从笔记标题元素提取（适配最新页面结构）
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
      
      // 【简化字段】删除地址元素提取逻辑
      
      // 【修复content提取】简化内容提取逻辑，不进行任何过滤，直接提取完整文本
      let textContent = ''
      let rawContent = ''
      
      // 方法1: 尝试从笔记主体内容区域提取（不排除任何区域）
      const noteContentSelectors = [
        '.note-content',           // 小红书笔记正文类名
        '.content',                 // 通用内容类名
        '[class*="note-content"]', // 包含note-content的类名
        '[class*="noteContent"]',  // 驼峰命名
        'article',                  // article标签
        '[class*="desc"]',          // 描述类名
        '[class*="text"]',          // 文本类名
        'main'                      // main标签
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
        // 优先使用笔记主体内容
        textContent = noteMainContent.innerText || noteMainContent.textContent || ''
        rawContent = textContent
      } else {
        // 方法2: 如果找不到笔记主体，尝试从body提取完整文本
        if (document.body) {
          textContent = document.body.innerText || document.body.textContent || ''
          rawContent = textContent
        }
      }
      
      // 方法3: 如果都没有，使用描述或标题
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
        title: noteTitle || title, // 优先使用从元素提取的标题
        description,
        keywordsMeta,
        textContent: textContent || '',
        rawContent: rawContent || ''
      }
    })

    // 【修复content提取】关闭所有内容过滤规则，直接返回完整的小红书页面文本
    let filteredRawContent = pageData.rawContent || pageData.description || ''
    let filteredTextContent = pageData.textContent || ''
    
    // 【排查1】确认是否成功获取到原始HTML
    const rawHtml = await page.content()
    console.log(`📄 原始HTML长度: ${rawHtml.length} 字符`)
    console.log(`📄 原始HTML预览（前500字符）: ${rawHtml.substring(0, 500)}...`)
    
    // 【排查2】检查content字段的提取选择器是否错误
    console.log(`📝 提取到文本内容长度: ${filteredTextContent.length} 字符`)
    console.log(`📝 标题: ${pageData.title}`)
    console.log(`📝 描述: ${pageData.description ? pageData.description.substring(0, 100) : '无'}...`)
    console.log(`📝 rawContent长度: ${pageData.rawContent ? pageData.rawContent.length : 0} 字符`)
    console.log(`📝 rawContent预览: ${pageData.rawContent ? pageData.rawContent.substring(0, 200) : '无'}...`)
    
    // 【修复1】关闭所有过滤规则，直接使用原始内容
    // 如果rawContent为空，尝试使用textContent或description
    if (!filteredRawContent || filteredRawContent.length < 5) {
      filteredRawContent = pageData.rawContent || pageData.textContent || pageData.description || pageData.title || ''
    }
    
    // 【排查3】如果仍然为空，尝试直接从body提取
    if (!filteredRawContent || filteredRawContent.length < 5) {
      const bodyContent = await page.evaluate(() => {
        return document.body ? (document.body.innerText || document.body.textContent || '') : ''
      })
      if (bodyContent && bodyContent.length > 5) {
        filteredRawContent = bodyContent
        console.log(`✅ 从body直接提取到内容: ${bodyContent.length} 字符`)
      }
    }

    // 【回滚】删除图片提取逻辑，只提取文本内容

    // 步骤9: 【优化7】解析文字信息，优化提取逻辑，使用过滤后的内容
    // 解析名称：优先使用从元素提取的标题，其次从meta标签提取
    let name = ''
    if (pageData.title && pageData.title.trim().length > 0) {
      name = pageData.title.split('|')[0].split('-')[0].split('_')[0].trim()
      // 清理可能的HTML标签
      name = name.replace(/<[^>]*>/g, '').trim()
      // 【优化15】验证名称是否包含无关信息
      if (hasUnrelatedContent(name)) {
        name = ''
      }
    }
    // 如果标题为空，尝试从描述中提取
    if (!name && pageData.description) {
      const descName = pageData.description.substring(0, 50).trim().split(/[，,。.\n]/)[0]
      if (!hasUnrelatedContent(descName)) {
        name = descName
      }
    }
    
    // 【简化字段】永久移除地址和人均字段的提取逻辑
    // 不再提取address和average字段
    
    // 【修复content提取】直接使用原始内容，不进行任何过滤
    let finalContent = filteredRawContent || pageData.textContent || pageData.description || pageData.title || ''
    
    // 【排查4】如果content仍然为空，尝试多种方式提取
    if (!finalContent || finalContent.length < 5) {
      // 方法1: 尝试从body直接提取
      const bodyContent = await page.evaluate(() => {
        if (!document.body) return ''
        // 尝试从main、article、.content等区域提取
        const mainContent = document.querySelector('main') || 
                          document.querySelector('article') || 
                          document.querySelector('.content') ||
                          document.querySelector('.note-content') ||
                          document.querySelector('[class*="content"]') ||
                          document.body
        return mainContent ? (mainContent.innerText || mainContent.textContent || '') : ''
      })
      
      if (bodyContent && bodyContent.length > 5) {
        finalContent = bodyContent
        console.log(`✅ 从body直接提取到内容: ${bodyContent.length} 字符`)
      }
    }

    // 体验关键词：优先 keywords meta，其次拆分描述
    let keywords = []
    if (pageData.keywordsMeta && pageData.keywordsMeta.trim()) {
      keywords = pageData.keywordsMeta.split(/[，,\/、]/).map((k) => k.trim()).filter(Boolean)
    }
    // 如果 keywords 为空，从描述中提取
    if (keywords.length === 0 && pageData.description) {
      keywords = pageData.description
        .split(/[，,\/、]/)
        .map((k) => k.trim())
        .filter((k) => k && k.length > 1 && k.length < 20) // 过滤太短或太长的词
        .slice(0, 6)
    }
    
    // 调试日志：输出解析结果
    console.log(`✅ 解析结果 - 名称: ${name || '暂无法提取'}`)
    console.log(`✅ 解析结果 - 关键词数量: ${keywords.length}`)
    console.log(`✅ 解析结果 - content长度: ${finalContent.length} 字符`)
    console.log(`✅ 解析结果 - content预览: ${finalContent.substring(0, 200)}...`)

    // 【回滚】删除图片处理逻辑

    // 步骤10: 关闭浏览器，释放资源
    await browser.close()
    browser = null

    // 步骤11: 【简化字段】构建返回结果，仅保留名称、content、体验关键词
    const result = {
      name: name || '暂无法提取',
      keywords: keywords || [],
      raw: {
        title: pageData.title || '',
        description: pageData.description || '',
        content: finalContent || '' // 【修复content提取】直接使用原始内容
      },
      // 【排查5】临时添加原始HTML预览（仅开发环境显示）
      debug: process.env.NODE_ENV !== 'production' ? {
        rawHtmlLength: rawHtml.length,
        rawHtmlPreview: rawHtml.substring(0, 1000), // 前1000字符
        textContentLength: filteredTextContent.length,
        rawContentLength: pageData.rawContent ? pageData.rawContent.length : 0
      } : undefined
    }
    
    // 【修复content提取】如果content为空，显示明确提示
    if (!result.raw.content || result.raw.content.length < 5) {
      console.warn('⚠️ 无法提取笔记内容')
      result.raw.content = '暂无法获取笔记内容'
    }

    // 调试日志：输出最终返回的数据结构
    console.log('📤 返回数据:', JSON.stringify(result, null, 2))

    return result

  } catch (error) {
    // 错误处理：确保浏览器被关闭
    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.error('关闭浏览器失败:', closeError)
      }
    }
    // 抛出错误，让调用者处理
    throw error
  }
}

/**
 * POST /api/xhs/parse
 * 请求体: { url: 'https://www.xiaohongshu.com/explore/xxxx' }
 * 返回: { name, keywords, raw: { title, description, content }, debug: { rawHtmlPreview, ... } }
 * 
 * 使用 Puppeteer 无头浏览器解析小红书页面，支持动态加载的内容
 * 包含重试机制：超时后自动重试1次
 */
app.post('/api/xhs/parse', async (req, res) => {
  const { url } = req.body || {}

  // 参数校验
  if (!url) {
    return res.status(400).json({ error: '请提供小红书链接参数 url' })
  }

  // 确保URL带协议
  const targetUrl = url.startsWith('http') ? url : `https://${url}`

  // 【关键修改7】重试机制：最多重试1次，超时后自动重试
  let lastError = null
  const maxRetries = 1

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt === 0) {
        console.log(`🚀 开始解析小红书链接（第1次尝试）:`, targetUrl)
      } else {
        console.log(`🔄 重试解析小红书链接（第${attempt + 1}次尝试）:`, targetUrl)
        // 【关键修改8】重试前等待2秒（使用 Promise，替代已废弃的 waitForTimeout）
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      // 调用解析函数
      const result = await parseXhsPage(targetUrl)

      // 解析成功，返回结果
      console.log(`✅ 解析成功（第${attempt + 1}次尝试）`)
      return res.json(result)

    } catch (error) {
      lastError = error
      const errorMessage = error?.message || '未知错误'
      
      // 【关键修改9】判断是否是超时错误（支持多种超时错误格式）
      const isTimeoutError = 
        errorMessage.includes('timeout') || 
        errorMessage.includes('Navigation timeout') ||
        errorMessage.includes('Timeout') ||
        errorMessage.includes('exceeded')
      
      if (isTimeoutError && attempt < maxRetries) {
        console.warn(`⚠️ 第${attempt + 1}次尝试超时（${errorMessage}），准备重试...`)
        // 继续重试
        continue
      } else {
        // 不是超时错误，或者已经重试过了，直接返回错误
        console.error(`❌ 小红书解析失败（第${attempt + 1}次尝试）:`, errorMessage)
        
        return res.status(500).json({
          error: '解析小红书链接失败，请检查链接是否有效或稍后重试',
          details: errorMessage,
          attempts: attempt + 1
        })
      }
    }
  }

  // 如果所有重试都失败了
  return res.status(500).json({
    error: '解析小红书链接失败，已重试但仍无法完成',
    details: lastError?.message || '未知错误',
    attempts: maxRetries + 1
  })
})

// ==================== 小红书站点库接口 ====================

// JSON文件存储路径（如果Supabase未配置，使用JSON文件）
const SITES_JSON_PATH = path.join(__dirname, 'data', 'xhs_sites.json')
const TRIPS_JSON_PATH = path.join(__dirname, 'data', 'trips.json')
const TRIP_SITES_JSON_PATH = path.join(__dirname, 'data', 'trip_sites.json')
const TRIP_ITEMS_JSON_PATH = path.join(__dirname, 'data', 'trip_items.json') // 【新增2】行程内容JSON文件路径

// 确保data目录存在
const ensureDataDir = () => {
  const dataDir = path.dirname(SITES_JSON_PATH)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  if (!fs.existsSync(SITES_JSON_PATH)) {
    fs.writeFileSync(SITES_JSON_PATH, JSON.stringify([], null, 2), 'utf-8')
  }
}

// 检查Supabase是否配置
const isSupabaseConfigured = () => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_KEY
  return supabaseUrl && supabaseUrl !== 'your-supabase-url' && 
         supabaseKey && supabaseKey !== 'your-supabase-key'
}

// 从JSON文件读取站点列表
const readSitesFromFile = () => {
  try {
    ensureDataDir()
    // 【修复3】确保文件存在，如果不存在则创建空数组
    if (!fs.existsSync(SITES_JSON_PATH)) {
      fs.writeFileSync(SITES_JSON_PATH, JSON.stringify([], null, 2), 'utf-8')
      return []
    }
    const data = fs.readFileSync(SITES_JSON_PATH, 'utf-8')
    if (!data || data.trim() === '') {
      return []
    }
    return JSON.parse(data)
  } catch (error) {
    console.error('读取JSON文件失败:', error)
    // 如果文件损坏，创建新文件
    try {
      fs.writeFileSync(SITES_JSON_PATH, JSON.stringify([], null, 2), 'utf-8')
    } catch (writeError) {
      console.error('创建JSON文件失败:', writeError)
    }
    return []
  }
}

// 保存站点到JSON文件
const saveSiteToFile = (siteData) => {
  try {
    ensureDataDir()
    const sites = readSitesFromFile()
    const newSite = {
      id: `site_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...siteData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    sites.push(newSite)
    fs.writeFileSync(SITES_JSON_PATH, JSON.stringify(sites, null, 2), 'utf-8')
    return newSite
  } catch (error) {
    console.error('保存到JSON文件失败:', error)
    throw error
  }
}

// ==================== 行程管理相关函数（JSON文件存储） ====================

// 从JSON文件读取行程列表
const readTripsFromFile = () => {
  try {
    ensureDataDir()
    if (!fs.existsSync(TRIPS_JSON_PATH)) {
      fs.writeFileSync(TRIPS_JSON_PATH, JSON.stringify([], null, 2), 'utf-8')
    }
    const data = fs.readFileSync(TRIPS_JSON_PATH, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('读取行程JSON文件失败:', error)
    return []
  }
}

// 保存行程到JSON文件
const saveTripToFile = (tripData) => {
  try {
    ensureDataDir()
    const trips = readTripsFromFile()
    const newTrip = {
      id: `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...tripData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    trips.push(newTrip)
    fs.writeFileSync(TRIPS_JSON_PATH, JSON.stringify(trips, null, 2), 'utf-8')
    return newTrip
  } catch (error) {
    console.error('保存行程到JSON文件失败:', error)
    throw error
  }
}

// 更新行程到JSON文件
const updateTripInFile = (tripId, tripData) => {
  try {
    ensureDataDir()
    const trips = readTripsFromFile()
    const index = trips.findIndex(t => t.id === tripId)
    if (index === -1) {
      throw new Error('行程不存在')
    }
    trips[index] = {
      ...trips[index],
      ...tripData,
      updated_at: new Date().toISOString()
    }
    fs.writeFileSync(TRIPS_JSON_PATH, JSON.stringify(trips, null, 2), 'utf-8')
    return trips[index]
  } catch (error) {
    console.error('更新行程失败:', error)
    throw error
  }
}

// 从JSON文件删除行程
const deleteTripFromFile = (tripId) => {
  try {
    ensureDataDir()
    const trips = readTripsFromFile()
    const filtered = trips.filter(t => t.id !== tripId)
    fs.writeFileSync(TRIPS_JSON_PATH, JSON.stringify(filtered, null, 2), 'utf-8')
    // 同时删除关联的站点
    deleteTripSitesFromFile(tripId)
    return true
  } catch (error) {
    console.error('删除行程失败:', error)
    throw error
  }
}

// 从JSON文件读取行程-站点关联
const readTripSitesFromFile = () => {
  try {
    ensureDataDir()
    if (!fs.existsSync(TRIP_SITES_JSON_PATH)) {
      fs.writeFileSync(TRIP_SITES_JSON_PATH, JSON.stringify([], null, 2), 'utf-8')
    }
    const data = fs.readFileSync(TRIP_SITES_JSON_PATH, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('读取行程站点关联JSON文件失败:', error)
    return []
  }
}

// 保存行程-站点关联到JSON文件
const saveTripSiteToFile = (tripSiteData) => {
  try {
    ensureDataDir()
    const tripSites = readTripSitesFromFile()
    // 检查是否已存在
    const exists = tripSites.find(
      ts => ts.trip_id === tripSiteData.trip_id && 
            ts.site_id === tripSiteData.site_id && 
            ts.day_number === tripSiteData.day_number
    )
    if (exists) {
      return exists // 已存在，直接返回
    }
    const newTripSite = {
      id: `trip_site_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...tripSiteData,
      created_at: new Date().toISOString()
    }
    tripSites.push(newTripSite)
    fs.writeFileSync(TRIP_SITES_JSON_PATH, JSON.stringify(tripSites, null, 2), 'utf-8')
    return newTripSite
  } catch (error) {
    console.error('保存行程站点关联失败:', error)
    throw error
  }
}

// 从JSON文件删除行程-站点关联
const deleteTripSiteFromFile = (tripSiteId) => {
  try {
    ensureDataDir()
    const tripSites = readTripSitesFromFile()
    const filtered = tripSites.filter(ts => ts.id !== tripSiteId)
    fs.writeFileSync(TRIP_SITES_JSON_PATH, JSON.stringify(filtered, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('删除行程站点关联失败:', error)
    throw error
  }
}

// 删除行程的所有站点关联
const deleteTripSitesFromFile = (tripId) => {
  try {
    ensureDataDir()
    const tripSites = readTripSitesFromFile()
    const filtered = tripSites.filter(ts => ts.trip_id !== tripId)
    fs.writeFileSync(TRIP_SITES_JSON_PATH, JSON.stringify(filtered, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('删除行程所有站点关联失败:', error)
    throw error
  }
}

// ==================== 行程内容（手动录入）相关函数（JSON文件存储） ====================

// 从JSON文件读取行程内容列表
const readTripItemsFromFile = () => {
  try {
    ensureDataDir()
    if (!fs.existsSync(TRIP_ITEMS_JSON_PATH)) {
      fs.writeFileSync(TRIP_ITEMS_JSON_PATH, JSON.stringify([], null, 2), 'utf-8')
    }
    const data = fs.readFileSync(TRIP_ITEMS_JSON_PATH, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('读取行程内容JSON文件失败:', error)
    return []
  }
}

// 保存行程内容到JSON文件
const saveTripItemToFile = (itemData) => {
  try {
    ensureDataDir()
    const items = readTripItemsFromFile()
    const newItem = {
      id: `trip_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...itemData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    items.push(newItem)
    fs.writeFileSync(TRIP_ITEMS_JSON_PATH, JSON.stringify(items, null, 2), 'utf-8')
    return newItem
  } catch (error) {
    console.error('保存行程内容到JSON文件失败:', error)
    throw error
  }
}

// 更新行程内容到JSON文件
const updateTripItemInFile = (itemId, itemData) => {
  try {
    ensureDataDir()
    const items = readTripItemsFromFile()
    const index = items.findIndex(item => item.id === itemId)
    if (index === -1) {
      throw new Error('行程内容不存在')
    }
    items[index] = {
      ...items[index],
      ...itemData,
      updated_at: new Date().toISOString()
    }
    fs.writeFileSync(TRIP_ITEMS_JSON_PATH, JSON.stringify(items, null, 2), 'utf-8')
    return items[index]
  } catch (error) {
    console.error('更新行程内容失败:', error)
    throw error
  }
}

// 从JSON文件删除行程内容
const deleteTripItemFromFile = (itemId) => {
  try {
    ensureDataDir()
    const items = readTripItemsFromFile()
    const filtered = items.filter(item => item.id !== itemId)
    fs.writeFileSync(TRIP_ITEMS_JSON_PATH, JSON.stringify(filtered, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('删除行程内容失败:', error)
    throw error
  }
}

// 删除行程的所有内容
const deleteTripItemsFromFile = (tripId) => {
  try {
    ensureDataDir()
    const items = readTripItemsFromFile()
    const filtered = items.filter(item => item.trip_id !== tripId)
    fs.writeFileSync(TRIP_ITEMS_JSON_PATH, JSON.stringify(filtered, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('删除行程所有内容失败:', error)
    throw error
  }
}

// 保存站点到数据库 (POST /api/xhs/sites)
app.post('/api/xhs/sites', async (req, res) => {
  try {
    const { site_name, xhs_url, content, tags, notes } = req.body

    // 验证必填字段
    if (!site_name || !xhs_url) {
      return res.status(400).json({ error: '站点名称和小红书链接为必填项' })
    }

    // 【回滚】删除图片相关逻辑

    // 【修复9】检查Supabase是否配置且可用，如果未配置则使用JSON文件存储
    if (isSupabaseConfigured() && supabase) {
      // 使用Supabase数据库
      try {
        const { data, error } = await supabase
          .from('xhs_sites')
          .insert([
            {
              site_name,
              xhs_url,
              content: content || '',
              tags: tags || [],
              notes: notes || ''
            }
          ])
          .select()
          .single()

        if (error) {
          throw error
        }

        console.log('✅ 站点已保存到Supabase数据库')
        return res.status(201).json(data)
      } catch (dbError) {
        console.warn('⚠️ Supabase保存失败，切换到JSON文件存储:', dbError.message)
        // 如果数据库失败，降级到JSON文件
      }
    }

    // 使用JSON文件存储（备选方案）
    const siteData = {
      site_name,
      xhs_url,
      content: content || '',
      tags: tags || [],
      notes: notes || ''
    }

    const savedSite = saveSiteToFile(siteData)
    console.log('✅ 站点已保存到JSON文件')
    return res.status(201).json(savedSite)

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '保存站点失败', details: err.message })
  }
})

// 获取所有站点 (GET /api/xhs/sites)
app.get('/api/xhs/sites', async (req, res) => {
  try {
    const { search, tag } = req.query

    // 【修复5】检查Supabase是否配置且可用，如果未配置则使用JSON文件
    if (isSupabaseConfigured() && supabase) {
      try {
        // 使用Supabase数据库
        let query = supabase.from('xhs_sites').select('*').order('created_at', { ascending: false })

        // 如果有关键词搜索
        if (search) {
          query = query.or(`site_name.ilike.%${search}%,content.ilike.%${search}%,notes.ilike.%${search}%`)
        }

        // 如果有标签筛选
        if (tag) {
          query = query.contains('tags', [tag])
        }

        const { data, error } = await query

        if (error) {
          throw error
        }

        return res.json(data || [])
      } catch (dbError) {
        console.warn('⚠️ Supabase查询失败，切换到JSON文件:', dbError.message)
        // 如果数据库失败，降级到JSON文件
      }
    }

    // 使用JSON文件存储（备选方案）
    let sites = readSitesFromFile()
    
    // 按创建时间倒序排序
    sites.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    
    // 关键词搜索
    if (search) {
      const searchLower = search.toLowerCase()
      sites = sites.filter(site => 
        (site.site_name && site.site_name.toLowerCase().includes(searchLower)) ||
        (site.content && site.content.toLowerCase().includes(searchLower)) ||
        (site.notes && site.notes.toLowerCase().includes(searchLower))
      )
    }
    
    // 标签筛选
    if (tag) {
      sites = sites.filter(site => 
        site.tags && Array.isArray(site.tags) && site.tags.includes(tag)
      )
    }

    return res.json(sites || [])

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '服务器内部错误', details: err.message })
  }
})

// 根据ID获取单个站点 (GET /api/xhs/sites/:id)
app.get('/api/xhs/sites/:id', async (req, res) => {
  try {
    const { id } = req.params

    // 【重构修复1】检查Supabase是否配置且可用
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('xhs_sites')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error
        
        // 统一返回格式
        return res.json({
          code: 200,
          data: data,
          msg: '成功'
        })
      } catch (dbError) {
        console.warn('⚠️ Supabase查询失败，切换到JSON文件:', dbError.message)
      }
    }

    // 使用JSON文件
    const sites = readSitesFromFile()
    const site = sites.find(s => s.id === id)
    
    if (!site) {
      return res.status(404).json({ 
        code: 404,
        data: null,
        msg: '站点不存在'
      })
    }

    // 【回滚】删除imageUrl兼容性处理

    // 统一返回格式
    return res.json({
      code: 200,
      data: site,
      msg: '成功'
    })
  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ 
      code: 500,
      data: null,
      msg: '服务器内部错误',
      error: err.message 
    })
  }
})

// 更新站点信息 (PUT /api/xhs/sites/:id)
app.put('/api/xhs/sites/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { site_name, content, tags, notes, xhs_url } = req.body

    // 构建更新对象
    const updates = {}
    if (site_name !== undefined) updates.site_name = site_name
    if (content !== undefined) updates.content = content
    // 【回滚】删除images字段更新
    if (tags !== undefined) updates.tags = tags
    if (notes !== undefined) updates.notes = notes
    if (xhs_url !== undefined) updates.xhs_url = xhs_url
    updates.updated_at = new Date().toISOString()

    // 【修复1】检查Supabase是否配置且可用
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('xhs_sites')
          .update(updates)
          .eq('id', id)
          .select()
          .single()

        if (error) throw error

        if (!data) {
          return res.status(404).json({ error: '站点不存在' })
        }

        return res.json(data)
      } catch (dbError) {
        console.warn('⚠️ Supabase更新失败，切换到JSON文件:', dbError.message)
      }
    }

    // 【修复2】使用JSON文件更新
    try {
      ensureDataDir()
      const sites = readSitesFromFile()
      const index = sites.findIndex(s => s.id === id)
      
      if (index === -1) {
        return res.status(404).json({ error: '站点不存在' })
      }

      // 更新站点数据（保留原有字段，只更新提供的字段）
      sites[index] = {
        ...sites[index],
        ...updates
      }

      // 写入JSON文件
      fs.writeFileSync(SITES_JSON_PATH, JSON.stringify(sites, null, 2), 'utf-8')
      
      console.log('✅ 站点已更新到JSON文件:', id)
      return res.json(sites[index])
    } catch (fileError) {
      console.error('更新JSON文件失败:', fileError)
      return res.status(500).json({ 
        error: '更新站点失败', 
        details: fileError.message 
      })
    }
  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ 
      error: '服务器内部错误', 
      details: err.message 
    })
  }
})

// 删除站点 (DELETE /api/xhs/sites/:id)
app.delete('/api/xhs/sites/:id', async (req, res) => {
  try {
    const { id } = req.params

    // 【修复6】检查supabase是否可用
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('xhs_sites').delete().eq('id', id)
        if (error) throw error
        return res.json({ message: '站点删除成功' })
      } catch (dbError) {
        console.warn('⚠️ Supabase删除失败，切换到JSON文件:', dbError.message)
      }
    }

    // 使用JSON文件（如果supabase不可用）
    const sites = readSitesFromFile()
    const filtered = sites.filter(s => s.id !== id)
    fs.writeFileSync(SITES_JSON_PATH, JSON.stringify(filtered, null, 2), 'utf-8')
    return res.json({ message: '站点删除成功' })

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '服务器内部错误', details: err.message })
  }
})

// ==================== 行程管理接口 ====================

// 创建行程 (POST /api/trips)
app.post('/api/trips', async (req, res) => {
  try {
    const { trip_name, start_date, end_date, notes } = req.body

    // 验证必填字段
    if (!trip_name) {
      return res.status(400).json({ error: '行程名称为必填项' })
    }

    const tripData = {
      trip_name,
      start_date: start_date || null,
      end_date: end_date || null,
      notes: notes || ''
    }

    // 【修复10】检查Supabase是否配置且可用
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('trips')
          .insert([tripData])
          .select()
          .single()

        if (error) throw error

        console.log('✅ 行程已保存到Supabase数据库')
        return res.status(201).json(data)
      } catch (dbError) {
        console.warn('⚠️ Supabase保存失败，切换到JSON文件存储:', dbError.message)
      }
    }

    // 使用JSON文件存储
    const savedTrip = saveTripToFile(tripData)
    console.log('✅ 行程已保存到JSON文件')
    return res.status(201).json(savedTrip)

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '创建行程失败', details: err.message })
  }
})

// 获取所有行程 (GET /api/trips)
app.get('/api/trips', async (req, res) => {
  try {
    let tripsData = []
    
    // 【修复11】检查Supabase是否配置且可用
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        tripsData = data || []
      } catch (dbError) {
        console.warn('⚠️ Supabase查询失败，切换到JSON文件:', dbError.message)
        // 如果Supabase查询失败，使用JSON文件
        const trips = readTripsFromFile()
        trips.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        tripsData = trips || []
      }
    } else {
      // 使用JSON文件
      const trips = readTripsFromFile()
      trips.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      tripsData = trips || []
    }

    // 【统一修复2】统一返回格式：{ code: 200, data: [...], msg: "成功" }
    return res.json({
      code: 200,
      data: tripsData,
      msg: '成功'
    })

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ 
      code: 500,
      data: [],
      msg: '查询行程列表失败',
      error: err.message 
    })
  }
})

// 获取单个行程及关联的站点 (GET /api/trips/:id)
app.get('/api/trips/:id', async (req, res) => {
  try {
    const { id } = req.params

    // 获取行程信息
    let trip = null
    // 【修复12】检查Supabase是否配置且可用
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error
        trip = data
      } catch (dbError) {
        console.warn('⚠️ Supabase查询失败，切换到JSON文件:', dbError.message)
      }
    }

    if (!trip) {
      const trips = readTripsFromFile()
      trip = trips.find(t => t.id === id)
    }

    if (!trip) {
      return res.status(404).json({ error: '行程不存在' })
    }

    // 获取关联的站点
    let tripSites = []
    // 【修复13】检查Supabase是否配置且可用
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('trip_sites')
          .select(`
            *,
            xhs_sites (
              id,
              site_name,
              xhs_url,
              content,
              images,
              tags,
              notes
            )
          `)
          .eq('trip_id', id)
          .order('day_number', { ascending: true })
          .order('sort_order', { ascending: true })

        if (error) throw error
        tripSites = data || []
      } catch (dbError) {
        console.warn('⚠️ Supabase查询失败，切换到JSON文件:', dbError.message)
      }
    }

    if (tripSites.length === 0) {
      // 从JSON文件读取
      const allTripSites = readTripSitesFromFile()
      const allSites = readSitesFromFile()
      tripSites = allTripSites
        .filter(ts => ts.trip_id === id)
        .map(ts => {
          const site = allSites.find(s => s.id === ts.site_id)
          return {
            ...ts,
            xhs_sites: site || null // 确保xhs_sites字段存在，兼容前端显示
          }
        })
        .sort((a, b) => {
          if (a.day_number !== b.day_number) {
            return a.day_number - b.day_number
          }
          return (a.sort_order || 0) - (b.sort_order || 0)
        })
    }

    // 【新增9】获取手动录入的行程内容
    let tripItems = []
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('trip_items')
          .select('*')
          .eq('trip_id', id)
          .order('day_number', { ascending: true })
          .order('sort_order', { ascending: true })

        if (error) throw error
        tripItems = data || []
      } catch (dbError) {
        console.warn('⚠️ Supabase查询行程内容失败，切换到JSON文件:', dbError.message)
        // Supabase查询失败，使用JSON文件
        const allTripItems = readTripItemsFromFile()
        tripItems = allTripItems
          .filter(item => item.trip_id === id)
          .sort((a, b) => {
            if (a.day_number !== b.day_number) {
              return a.day_number - b.day_number
            }
            return (a.sort_order || 0) - (b.sort_order || 0)
          })
      }
    } else {
      // Supabase未配置，使用JSON文件
      const allTripItems = readTripItemsFromFile()
      tripItems = allTripItems
        .filter(item => item.trip_id === id)
        .sort((a, b) => {
          if (a.day_number !== b.day_number) {
            return a.day_number - b.day_number
          }
          return (a.sort_order || 0) - (b.sort_order || 0)
        })
    }

    // 【统一修复3】统一返回格式：{ code: 200, data: {...}, msg: "成功" }
    return res.json({
      code: 200,
      data: {
        ...trip,
        sites: tripSites, // 关联的第三方攻略
        items: tripItems  // 【新增10】手动录入的行程内容
      },
      msg: '成功'
    })

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ 
      code: 500,
      data: null,
      msg: '查询行程失败',
      error: err.message 
    })
  }
})

// 更新行程 (PUT /api/trips/:id)
app.put('/api/trips/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { trip_name, start_date, end_date, notes } = req.body

    const updates = {}
    if (trip_name) updates.trip_name = trip_name
    if (start_date !== undefined) updates.start_date = start_date
    if (end_date !== undefined) updates.end_date = end_date
    if (notes !== undefined) updates.notes = notes
    updates.updated_at = new Date().toISOString()

    // 【修复14】检查Supabase是否配置且可用
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('trips')
          .update(updates)
          .eq('id', id)
          .select()
          .single()

        if (error) throw error
        if (!data) {
          return res.status(404).json({ error: '行程不存在' })
        }

        return res.json(data)
      } catch (dbError) {
        console.warn('⚠️ Supabase更新失败，切换到JSON文件:', dbError.message)
      }
    }

    // 使用JSON文件
    const updatedTrip = updateTripInFile(id, updates)
    return res.json(updatedTrip)

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '更新行程失败', details: err.message })
  }
})

// 删除行程 (DELETE /api/trips/:id)
app.delete('/api/trips/:id', async (req, res) => {
  try {
    const { id } = req.params

    // 【修复7】检查supabase是否可用
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('trips').delete().eq('id', id)
        if (error) throw error
        // 级联删除会自动删除关联的trip_sites和trip_items
        return res.json({ message: '行程删除成功' })
      } catch (dbError) {
        console.warn('⚠️ Supabase删除失败，切换到JSON文件:', dbError.message)
      }
    }

    // 使用JSON文件
    deleteTripFromFile(id)
    // 【新增8】同时删除关联的行程内容和攻略关联
    deleteTripItemsFromFile(id)
    deleteTripSitesFromFile(id)
    return res.json({ message: '行程删除成功' })

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '删除行程失败', details: err.message })
  }
})

// 给行程添加站点 (POST /api/trips/:tripId/sites)
app.post('/api/trips/:tripId/sites', async (req, res) => {
  try {
    const { tripId } = req.params
    const { site_id, day_number, sort_order } = req.body

    if (!site_id) {
      return res.status(400).json({ error: '站点ID为必填项' })
    }

    const tripSiteData = {
      trip_id: tripId,
      site_id,
      day_number: day_number || 1,
      sort_order: sort_order || 0
    }

    // 【修复15】检查Supabase是否配置且可用
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('trip_sites')
          .insert([tripSiteData])
          .select()
          .single()

        if (error) throw error
        return res.status(201).json(data)
      } catch (dbError) {
        console.warn('⚠️ Supabase保存失败，切换到JSON文件:', dbError.message)
      }
    }

    // 使用JSON文件
    const savedTripSite = saveTripSiteToFile(tripSiteData)
    return res.status(201).json(savedTripSite)

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '添加站点失败', details: err.message })
  }
})

// 从行程移除站点 (DELETE /api/trips/:tripId/sites/:tripSiteId)
app.delete('/api/trips/:tripId/sites/:tripSiteId', async (req, res) => {
  try {
    const { tripSiteId } = req.params

    // 【修复8】检查supabase是否可用
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('trip_sites').delete().eq('id', tripSiteId)
        if (error) throw error
        return res.json({ message: '站点移除成功' })
      } catch (dbError) {
        console.warn('⚠️ Supabase删除失败，切换到JSON文件:', dbError.message)
      }
    }

    // 使用JSON文件
    deleteTripSiteFromFile(tripSiteId)
    return res.json({ message: '站点移除成功' })

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '移除站点失败', details: err.message })
  }
})

// 更新行程站点顺序 (PUT /api/trips/:tripId/sites/:tripSiteId/order)
app.put('/api/trips/:tripId/sites/:tripSiteId/order', async (req, res) => {
  try {
    const { tripSiteId } = req.params
    const { day_number, sort_order } = req.body

    // 【修复16】检查Supabase是否配置且可用
    if (isSupabaseConfigured() && supabase) {
      try {
        const updates = {}
        if (day_number !== undefined) updates.day_number = day_number
        if (sort_order !== undefined) updates.sort_order = sort_order

        const { data, error } = await supabase
          .from('trip_sites')
          .update(updates)
          .eq('id', tripSiteId)
          .select()
          .single()

        if (error) throw error
        return res.json(data)
      } catch (dbError) {
        console.warn('⚠️ Supabase更新失败，切换到JSON文件:', dbError.message)
      }
    }

    // 使用JSON文件
    const tripSites = readTripSitesFromFile()
    const index = tripSites.findIndex(ts => ts.id === tripSiteId)
    if (index === -1) {
      return res.status(404).json({ error: '关联不存在' })
    }

    if (day_number !== undefined) tripSites[index].day_number = day_number
    if (sort_order !== undefined) tripSites[index].sort_order = sort_order

    fs.writeFileSync(TRIP_SITES_JSON_PATH, JSON.stringify(tripSites, null, 2), 'utf-8')
    return res.json(tripSites[index])

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '更新顺序失败', details: err.message })
  }
})

// ==================== 行程内容（手动录入）接口 ====================

// 给行程添加手动录入内容 (POST /api/trips/:tripId/items)
app.post('/api/trips/:tripId/items', async (req, res) => {
  try {
    const { tripId } = req.params
    const { place_name, address, description, duration, budget, notes, day_number, sort_order } = req.body

    if (!place_name) {
      return res.status(400).json({ error: '地点名称为必填项' })
    }

    const itemData = {
      trip_id: tripId,
      place_name,
      address: address || '',
      description: description || '',
      duration: duration || '',
      budget: budget || '',
      notes: notes || '',
      day_number: day_number || 1,
      sort_order: sort_order || 0
    }

    // 【修复17】检查Supabase是否配置且可用
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('trip_items')
          .insert([itemData])
          .select()
          .single()

        if (error) throw error
        return res.status(201).json(data)
      } catch (dbError) {
        console.warn('⚠️ Supabase保存失败，切换到JSON文件:', dbError.message)
      }
    }

    // 使用JSON文件
    const savedItem = saveTripItemToFile(itemData)
    return res.status(201).json(savedItem)

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '添加行程内容失败', details: err.message })
  }
})

// 更新行程内容 (PUT /api/trips/:tripId/items/:itemId)
app.put('/api/trips/:tripId/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params
    const { place_name, address, description, duration, budget, notes, day_number, sort_order, lat, lng } = req.body

    const updates = {}
    if (place_name !== undefined) updates.place_name = place_name
    if (address !== undefined) updates.address = address
    if (description !== undefined) updates.description = description
    if (duration !== undefined) updates.duration = duration
    if (budget !== undefined) updates.budget = budget
    if (notes !== undefined) updates.notes = notes
    if (day_number !== undefined) updates.day_number = day_number
    if (sort_order !== undefined) updates.sort_order = sort_order
    if (lat !== undefined) updates.lat = lat
    if (lng !== undefined) updates.lng = lng
    updates.updated_at = new Date().toISOString()

    // 【修复18】检查Supabase是否配置且可用
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('trip_items')
          .update(updates)
          .eq('id', itemId)
          .select()
          .single()

        if (error) throw error
        if (!data) {
          return res.status(404).json({ error: '行程内容不存在' })
        }
        return res.json(data)
      } catch (dbError) {
        console.warn('⚠️ Supabase更新失败，切换到JSON文件:', dbError.message)
      }
    }

    // 使用JSON文件
    const updatedItem = updateTripItemInFile(itemId, updates)
    return res.json(updatedItem)

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '更新行程内容失败', details: err.message })
  }
})

// 删除行程内容 (DELETE /api/trips/:tripId/items/:itemId)
app.delete('/api/trips/:tripId/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params

    // 【修复19】检查supabase是否可用
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('trip_items').delete().eq('id', itemId)
        if (error) throw error
        return res.json({ message: '行程内容删除成功' })
      } catch (dbError) {
        console.warn('⚠️ Supabase删除失败，切换到JSON文件:', dbError.message)
      }
    }

    // 使用JSON文件
    deleteTripItemFromFile(itemId)
    return res.json({ message: '行程内容删除成功' })

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '删除行程内容失败', details: err.message })
  }
})

// ==================== 地图API接口 ====================

// 高德地图API Key（从环境变量获取）
const AMAP_API_KEY = process.env.AMAP_API_KEY || 'YOUR_AMAP_API_KEY'
// Google Maps API Key（从环境变量获取）
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'YOUR_GOOGLE_API_KEY'

/**
 * POST /api/maps/reverse-geocode
 * 逆地理编码：将坐标转换为地址（优先使用高德地图）
 * 请求体: { lng: 116.397428, lat: 39.90923 }
 * 返回: { address: '北京市东城区xxx' }
 */
app.post('/api/maps/reverse-geocode', async (req, res) => {
  const { lng, lat } = req.body || {}
  
  if (!lng || !lat) {
    return res.status(400).json({ error: '请提供坐标参数 lng 和 lat' })
  }
  
  try {
    // 优先使用高德地图逆地理编码
    const amapUrl = `https://restapi.amap.com/v3/geocode/regeo`
    const amapResponse = await fetch(`${amapUrl}?key=${AMAP_API_KEY}&location=${lng},${lat}&radius=1000&extensions=all`)
    const amapData = await amapResponse.json()
    
    if (amapData.status === '1' && amapData.regeocode) {
      const address = amapData.regeocode.formatted_address || amapData.regeocode.addressComponent?.province + amapData.regeocode.addressComponent?.city + amapData.regeocode.addressComponent?.district
      return res.json({
        code: 200,
        data: {
          address: address || ''
        },
        msg: '成功'
      })
    }
    
    // 如果高德地图失败，尝试Google Maps
    if (GOOGLE_API_KEY && GOOGLE_API_KEY !== 'YOUR_GOOGLE_API_KEY') {
      const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json`
      const googleResponse = await fetch(`${googleUrl}?key=${GOOGLE_API_KEY}&latlng=${lat},${lng}`)
      const googleData = await googleResponse.json()
      
      if (googleData.status === 'OK' && googleData.results && googleData.results.length > 0) {
        return res.json({
          code: 200,
          data: {
            address: googleData.results[0].formatted_address || ''
          },
          msg: '成功'
        })
      }
    }
    
    return res.status(404).json({ error: '未找到该坐标的地址' })
  } catch (err) {
    console.error('逆地理编码失败:', err)
    return res.status(500).json({ error: '逆地理编码失败', details: err.message })
  }
})

/**
 * POST /api/maps/geocode
 * 地理编码：将地址转换为坐标（优先使用高德地图）
 * 请求体: { address: '北京市朝阳区xxx' }
 * 返回: { lat: 39.90923, lng: 116.397428 }
 */
app.post('/api/maps/geocode', async (req, res) => {
  const { address } = req.body || {}
  
  if (!address) {
    return res.status(400).json({ error: '请提供地址参数' })
  }
  
  try {
    // 优先使用高德地图地理编码
    const amapUrl = `https://restapi.amap.com/v3/geocode/geo`
    const amapResponse = await fetch(`${amapUrl}?key=${AMAP_API_KEY}&address=${encodeURIComponent(address)}`)
    const amapData = await amapResponse.json()
    
    if (amapData.status === '1' && amapData.geocodes && amapData.geocodes.length > 0) {
      const location = amapData.geocodes[0].location.split(',')
      return res.json({
        code: 200,
        data: {
          lat: parseFloat(location[1]),
          lng: parseFloat(location[0])
        },
        msg: '成功'
      })
    }
    
    // 如果高德地图失败，尝试Google Maps
    if (GOOGLE_API_KEY && GOOGLE_API_KEY !== 'YOUR_GOOGLE_API_KEY') {
      const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json`
      const googleResponse = await fetch(`${googleUrl}?key=${GOOGLE_API_KEY}&address=${encodeURIComponent(address)}`)
      const googleData = await googleResponse.json()
      
      if (googleData.status === 'OK' && googleData.results && googleData.results.length > 0) {
        const location = googleData.results[0].geometry.location
        return res.json({
          code: 200,
          data: {
            lat: location.lat,
            lng: location.lng
          },
          msg: '成功'
        })
      }
    }
    
    return res.status(404).json({ error: '未找到该地址的坐标' })
  } catch (err) {
    console.error('地理编码失败:', err)
    return res.status(500).json({ error: '地理编码失败', details: err.message })
  }
})

/**
 * POST /api/maps/route/amap
 * 高德地图路线规划
 * 请求体: { coordinates: [{ lng: 116.397428, lat: 39.90923, name: '地点1' }, ...] }
 * 返回: { distance: '10公里', duration: '30分钟', steps: [...], path: [...] }
 */
app.post('/api/maps/route/amap', async (req, res) => {
  const { coordinates } = req.body || {}
  
  if (!coordinates || coordinates.length < 2) {
    return res.status(400).json({ error: '请提供至少2个坐标点' })
  }
  
  try {
    // 构建高德地图路径规划URL
    const waypoints = coordinates.map(c => `${c.lng},${c.lat}`).join('|')
    const url = `https://restapi.amap.com/v3/direction/driving?key=${AMAP_API_KEY}&origin=${waypoints.split('|')[0]}&destination=${waypoints.split('|')[waypoints.split('|').length - 1]}&waypoints=${waypoints.split('|').slice(1, -1).join('|')}&extensions=all`
    
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.status === '1' && data.route && data.route.paths && data.route.paths.length > 0) {
      const path = data.route.paths[0]
      const steps = path.steps.map((step, index) => ({
        instruction: step.instruction || `第${index + 1}步`,
        distance: step.distance ? `${(step.distance / 1000).toFixed(2)}公里` : '',
        duration: step.duration ? `${Math.round(step.duration / 60)}分钟` : ''
      }))
      
      // 提取路径点
      const pathPoints = path.steps.flatMap(step => {
        const polyline = step.polyline.split(';')
        return polyline.map(point => {
          const [lng, lat] = point.split(',')
          return { lng: parseFloat(lng), lat: parseFloat(lat) }
        })
      })
      
      return res.json({
        code: 200,
        data: {
          distance: path.distance ? `${(path.distance / 1000).toFixed(2)}公里` : '未知',
          duration: path.duration ? `${Math.round(path.duration / 60)}分钟` : '未知',
          steps: steps,
          path: pathPoints
        },
        msg: '成功'
      })
    }
    
    return res.status(404).json({ error: '路线规划失败' })
  } catch (err) {
    console.error('高德地图路线规划失败:', err)
    return res.status(500).json({ error: '路线规划失败', details: err.message })
  }
})

/**
 * POST /api/maps/route/google
 * Google Maps路线规划
 * 请求体: { coordinates: [{ lng: 116.397428, lat: 39.90923, name: '地点1' }, ...] }
 * 返回: { distance: '10公里', duration: '30分钟', steps: [...], path: [...] }
 */
app.post('/api/maps/route/google', async (req, res) => {
  const { coordinates } = req.body || {}
  
  if (!coordinates || coordinates.length < 2) {
    return res.status(400).json({ error: '请提供至少2个坐标点' })
  }
  
  if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'YOUR_GOOGLE_API_KEY') {
    return res.status(400).json({ error: 'Google Maps API Key未配置' })
  }
  
  try {
    // 构建Google Maps路径规划URL
    const origin = `${coordinates[0].lat},${coordinates[0].lng}`
    const destination = `${coordinates[coordinates.length - 1].lat},${coordinates[coordinates.length - 1].lng}`
    const waypoints = coordinates.slice(1, -1).map(c => `${c.lat},${c.lng}`).join('|')
    
    let url = `https://maps.googleapis.com/maps/api/directions/json?key=${GOOGLE_API_KEY}&origin=${origin}&destination=${destination}`
    if (waypoints) {
      url += `&waypoints=${waypoints}`
    }
    
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.status === 'OK' && data.routes && data.routes.length > 0) {
      const route = data.routes[0]
      const leg = route.legs[0]
      
      const steps = route.legs.flatMap(leg => 
        leg.steps.map((step, index) => ({
          instruction: step.html_instructions.replace(/<[^>]*>/g, '') || `第${index + 1}步`,
          distance: step.distance ? step.distance.text : '',
          duration: step.duration ? step.duration.text : ''
        }))
      )
      
      // 提取路径点
      const pathPoints = route.overview_polyline.points
        ? decodePolyline(route.overview_polyline.points)
        : []
      
      return res.json({
        code: 200,
        data: {
          distance: leg.distance ? leg.distance.text : '未知',
          duration: leg.duration ? leg.duration.text : '未知',
          steps: steps,
          path: pathPoints
        },
        msg: '成功'
      })
    }
    
    return res.status(404).json({ error: '路线规划失败', details: data.status })
  } catch (err) {
    console.error('Google Maps路线规划失败:', err)
    return res.status(500).json({ error: '路线规划失败', details: err.message })
  }
})

// 解码Google Maps Polyline
function decodePolyline(encoded) {
  const points = []
  let index = 0
  const len = encoded.length
  let lat = 0
  let lng = 0
  
  while (index < len) {
    let b, shift = 0, result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))
    lat += dlat
    
    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))
    lng += dlng
    
    points.push({ lat: lat * 1e-5, lng: lng * 1e-5 })
  }
  
  return points
}

// ==================== 启动服务器 ====================
app.listen(PORT, () => {
  console.log(`🚀 TripSync后端服务运行在 http://localhost:${PORT}`)
  console.log(`📝 健康检查: http://localhost:${PORT}/api/health`)
  console.log(`⚠️  请确保已配置Supabase连接信息`)
  console.log(`🗺️  地图API: 高德地图=${AMAP_API_KEY !== 'YOUR_AMAP_API_KEY' ? '已配置' : '未配置'}, Google Maps=${GOOGLE_API_KEY !== 'YOUR_GOOGLE_API_KEY' ? '已配置' : '未配置'}`)
})


