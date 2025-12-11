import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// 【重构】导入存储适配层
import * as storage from './storageAdapter.js'
// 【新增】引入地图路由
import mapRouter from './routes/map.js'
// 【优化】导入统一错误处理中间件
import { errorHandler, asyncHandler, successResponse, errorResponse } from './utils/errorHandler.js'
// 【优化】导入地图Key工具函数
import { getMapKeys, isMapKeyConfigured } from './utils/mapKey.js'
// 【优化】导入小红书解析工具函数
import { hasLoginPrompt, hasUnrelatedContent, filterUnrelatedContent, extractPageContent, getRandomUserAgent, MOBILE_USER_AGENT } from './utils/xhsParser.js'

// 获取当前文件目录（ES模块）
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config()

// 【新增】读取存储模式并输出日志
const STORAGE_MODE = process.env.STORAGE_MODE || 'local'
console.log(`\n📦 当前存储模式: ${STORAGE_MODE === 'supabase' ? 'Supabase数据库' : '本地JSON文件'}`)
console.log(`   - 修改 backend/.env 中的 STORAGE_MODE 可切换存储方式\n`)

// 创建Express应用
const app = express()
const PORT = 3008

// 【修复3】中间件配置 - 确保顺序正确
app.use(cors()) // 允许跨域请求
app.use(express.json()) // 解析JSON请求体
app.use(express.urlencoded({ extended: true })) // 解析URL编码的请求体

// 【新增】挂载地图路由
app.use('/api/map', mapRouter)

// 【优化】注册全局错误处理中间件（必须在所有路由之后）
app.use(errorHandler)

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
app.get('/api/guides', asyncHandler(async (req, res) => {
  // 【重构】暂时返回空数组（guides功能未完全实现）
  // 如果后续需要，可以在storageAdapter.js中添加guides相关方法
  let guidesData = []
  
  // 【优化】使用统一的成功响应格式
  return res.json(successResponse(guidesData, '成功'))
}))

// 根据ID获取单个攻略 (GET /api/guides/:id)
app.get('/api/guides/:id', async (req, res) => {
  try {
    // 【重构】攻略功能暂未在存储适配层实现，暂时返回错误
    return res.status(501).json({ 
      error: '攻略功能暂未实现',
      message: '该功能正在开发中，请使用第三方攻略库功能'
    })
  } catch (err) {
    console.error('服务器错误:', err)
    res.status(500).json({ error: '服务器内部错误', details: err.message })
  }
})

// 创建新攻略 (POST /api/guides)
app.post('/api/guides', async (req, res) => {
  try {
    // 【重构】攻略功能暂未在存储适配层实现，暂时返回错误
    return res.status(501).json({ 
      error: '攻略功能暂未实现',
      message: '该功能正在开发中，请使用第三方攻略库功能'
    })
  } catch (err) {
    console.error('服务器错误:', err)
    res.status(500).json({ error: '服务器内部错误', details: err.message })
  }
})

// 更新攻略 (PUT /api/guides/:id)
app.put('/api/guides/:id', async (req, res) => {
  try {
    // 【重构】攻略功能暂未在存储适配层实现，暂时返回错误
    return res.status(501).json({ 
      error: '攻略功能暂未实现',
      message: '该功能正在开发中，请使用第三方攻略库功能'
    })
  } catch (err) {
    console.error('服务器错误:', err)
    res.status(500).json({ error: '服务器内部错误', details: err.message })
  }
})

// 删除攻略 (DELETE /api/guides/:id)
app.delete('/api/guides/:id', async (req, res) => {
  try {
    // 【重构】攻略功能暂未在存储适配层实现，暂时返回错误
    return res.status(501).json({ 
      error: '攻略功能暂未实现',
      message: '该功能正在开发中，请使用第三方攻略库功能'
    })
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
// const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'

// 从HTML中提取字段的辅助方法（正则兜底）
const pickByRegex = (html = '', patterns = []) => {
  for (const reg of patterns) {
    const match = html.match(reg)
    if (match && match[1]) return match[1].trim()
  }
  return ''
}

// 【优化】已迁移到 utils/xhsParser.js，删除重复代码
// getRandomUserAgent, hasLoginPrompt, hasUnrelatedContent, filterUnrelatedContent 等函数已移至 utils/xhsParser.js

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

    // 步骤3: 【优化】设置随机 User-Agent，模拟不同浏览器（使用工具函数）
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

    // 【优化】提取页面文字信息（使用工具函数）
    const pageData = await extractPageContent(page)

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

// 【优化】已迁移到 storageAdapter.js，删除重复代码
// readTripsFromFile, saveTripToFile, updateTripInFile, deleteTripFromFile 等函数已移至 storageAdapter.js
// 所有行程存储操作统一使用 storage.readTrips(), storage.saveTrip(), storage.updateTrip(), storage.deleteTrip() 等方法

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
      // 【重构】兼容旧数据：如果没有date字段，使用day_number生成date
      date: itemData.date || (itemData.day_number ? `day_${itemData.day_number}` : new Date().toISOString().split('T')[0]),
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
    const { site_name, xhs_url, content, tags, notes, address, lat, lng } = req.body

    // 验证必填字段
    if (!site_name || !xhs_url) {
      return res.status(400).json({ error: '站点名称和小红书链接为必填项' })
    }

    // 【重构】使用存储适配层
    const siteData = {
      site_name,
      xhs_url,
      content: content || '',
      tags: tags || [],
      notes: notes || '',
      address: address || null,
      lat: lat || null,
      lng: lng || null
    }

    const savedSite = await storage.saveSite(siteData)
    console.log(`✅ 站点已保存到${STORAGE_MODE === 'supabase' ? 'Supabase数据库' : 'JSON文件'}`)
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

    // 【重构】使用存储适配层
    let sites = []
    
    if (search || tag) {
      // 有搜索条件，使用搜索方法
      sites = await storage.searchSites(search, tag)
    } else {
      // 无搜索条件，直接读取所有
      sites = await storage.readSites()
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

    // 【重构】使用存储适配层
    const site = await storage.readSiteById(id)
    
    if (!site) {
      return res.status(404).json({ 
        code: 404,
        data: null,
        msg: '站点不存在'
      })
    }

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
    const { site_name, content, tags, notes, xhs_url, address, lat, lng } = req.body

    // 构建更新对象
    const updates = {}
    if (site_name !== undefined) updates.site_name = site_name
    if (content !== undefined) updates.content = content
    if (tags !== undefined) updates.tags = tags
    if (notes !== undefined) updates.notes = notes
    if (xhs_url !== undefined) updates.xhs_url = xhs_url
    if (address !== undefined) updates.address = address || null
    if (lat !== undefined) updates.lat = lat || null
    if (lng !== undefined) updates.lng = lng || null

    // 【重构】使用存储适配层
    try {
      const updatedSite = await storage.updateSite(id, updates)
      console.log(`✅ 站点已更新到${STORAGE_MODE === 'supabase' ? 'Supabase数据库' : 'JSON文件'}:`, id)
      return res.json(updatedSite)
    } catch (fileError) {
      if (fileError.message === '站点不存在') {
        return res.status(404).json({ error: '站点不存在' })
      }
      console.error('更新站点失败:', fileError)
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

    // 【重构】使用存储适配层
    await storage.deleteSite(id)
    console.log(`✅ 站点已从${STORAGE_MODE === 'supabase' ? 'Supabase数据库' : 'JSON文件'}删除`)
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

    // 【重构】使用存储适配层
    const savedTrip = await storage.saveTrip(tripData)
    console.log(`✅ 行程已保存到${STORAGE_MODE === 'supabase' ? 'Supabase数据库' : 'JSON文件'}`)
    return res.status(201).json(savedTrip)

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '创建行程失败', details: err.message })
  }
})

// 获取所有行程 (GET /api/trips)
app.get('/api/trips', async (req, res) => {
  try {
    // 【重构】使用存储适配层
    const tripsData = await storage.readTrips()
    
    // 按创建时间倒序排序
    tripsData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    // 统一返回格式
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

    // 【重构】使用存储适配层获取行程信息
    const trip = await storage.readTripById(id)

    if (!trip) {
      return res.status(404).json({ error: '行程不存在' })
    }

    // 获取关联的站点（保留原逻辑，因为涉及关联查询）
    // TODO: 如果后续需要，可以在storageAdapter中添加trip_sites相关方法
    // 暂时使用JSON文件读取（trip_sites功能较少使用）
    let tripSites = []
    if (STORAGE_MODE === 'local') {
      // 本地模式：从JSON文件读取
      const allTripSites = readTripSitesFromFile()
      const allSites = await storage.readSites()
      tripSites = allTripSites
        .filter(ts => ts.trip_id === id)
        .map(ts => {
          const site = allSites.find(s => s.id === ts.site_id)
          return {
            ...ts,
            xhs_sites: site || null
          }
        })
        .sort((a, b) => {
          if (a.day_number !== b.day_number) {
            return a.day_number - b.day_number
          }
          return (a.sort_order || 0) - (b.sort_order || 0)
        })
    } else {
      // Supabase模式：通过storageAdapter（如果后续实现）
      // 暂时返回空数组
      tripSites = []
    }

    // 【重构】使用存储适配层获取行程内容
    const tripItems = await storage.readTripItems(id)

    // 统一返回格式
    return res.json({
      code: 200,
      data: {
        ...trip,
        sites: tripSites, // 关联的第三方攻略
        items: tripItems  // 手动录入的行程内容
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

    // 【重构】使用存储适配层
    try {
      const updatedTrip = await storage.updateTrip(id, updates)
      console.log(`✅ 行程已更新到${STORAGE_MODE === 'supabase' ? 'Supabase数据库' : 'JSON文件'}`)
      return res.json(updatedTrip)
    } catch (fileError) {
      if (fileError.message === '行程不存在') {
        return res.status(404).json({ error: '行程不存在' })
      }
      throw fileError
    }

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '更新行程失败', details: err.message })
  }
})

// 删除行程 (DELETE /api/trips/:id)
app.delete('/api/trips/:id', async (req, res) => {
  try {
    const { id } = req.params

    // 【重构】使用存储适配层
    await storage.deleteTrip(id)
    // 同时删除关联的行程内容
    await storage.deleteTripItems(id)
    // 删除关联的攻略关联（使用JSON文件方法，因为trip_sites暂未在适配层实现）
    if (STORAGE_MODE === 'local') {
      deleteTripSitesFromFile(id)
    }
    
    console.log(`✅ 行程已从${STORAGE_MODE === 'supabase' ? 'Supabase数据库' : 'JSON文件'}删除`)
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

    // 【重构】暂时使用JSON文件（trip_sites功能较少使用，后续可在适配层实现）
    // 注意：在STORAGE_MODE=local时，直接使用JSON文件方法，避免引用未定义的supabase
    const savedTripSite = saveTripSiteToFile(tripSiteData)
    console.log(`✅ 行程站点关联已保存到${STORAGE_MODE === 'supabase' ? 'Supabase数据库' : 'JSON文件'}`)
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

    // 【重构】暂时使用JSON文件（trip_sites功能较少使用，后续可在适配层实现）
    deleteTripSiteFromFile(tripSiteId)
    console.log(`✅ 行程站点关联已从${STORAGE_MODE === 'supabase' ? 'Supabase数据库' : 'JSON文件'}删除`)
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

    // 【重构】暂时使用JSON文件（trip_sites功能较少使用，后续可在适配层实现）
    const updates = {}
    if (day_number !== undefined) updates.day_number = day_number
    if (sort_order !== undefined) updates.sort_order = sort_order

    const tripSites = readTripSitesFromFile()
    const index = tripSites.findIndex(ts => ts.id === tripSiteId)
    if (index === -1) {
      return res.status(404).json({ error: '关联不存在' })
    }

    tripSites[index] = {
      ...tripSites[index],
      ...updates
    }

    fs.writeFileSync(TRIP_SITES_JSON_PATH, JSON.stringify(tripSites, null, 2), 'utf-8')
    console.log(`✅ 行程站点顺序已更新到${STORAGE_MODE === 'supabase' ? 'Supabase数据库' : 'JSON文件'}`)
    return res.json(tripSites[index])

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '更新顺序失败', details: err.message })
  }
})

// ==================== 行程内容（单日多平级站点）接口 ====================

// 【重构】批量保存单日行程（日期+主题+多个平级站点） (POST /api/trips/:tripId/day-items)
app.post('/api/trips/:tripId/day-items', async (req, res) => {
  try {
    const { tripId } = req.params
    const { date, theme, items } = req.body

    if (!date) {
      return res.status(400).json({ error: '日期为必填项' })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: '至少需要一个行程站点' })
    }

    // 验证每个站点都有地点名称
    for (let i = 0; i < items.length; i++) {
      if (!items[i].place_name) {
        return res.status(400).json({ error: `第${i + 1}个站点的地点名称为必填项` })
      }
    }

    // 【重构】使用存储适配层
    const savedItems = await storage.saveTripItemsByDate(tripId, date, theme, items)

    return res.status(201).json({
      code: 200,
      data: savedItems,
      msg: '保存成功'
    })

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ 
      code: 500,
      data: null,
      msg: '保存单日行程失败',
      error: err.message 
    })
  }
})

// 【保留】单个添加行程内容（兼容旧接口） (POST /api/trips/:tripId/items)
app.post('/api/trips/:tripId/items', async (req, res) => {
  try {
    const { tripId } = req.params
    const { place_name, address, description, duration, budget, notes, date, theme, sort_order, lat, lng } = req.body

    if (!place_name) {
      return res.status(400).json({ error: '地点名称为必填项' })
    }

    const itemData = {
      date: date || new Date().toISOString().split('T')[0], // 默认今天
      theme: theme || null,
      place_name,
      address: address || null,
      description: description || null,
      duration: duration || null,
      budget: budget || null,
      notes: notes || null,
      lat: lat || null,
      lng: lng || null,
      sort_order: sort_order || 0
    }

    // 【重构】使用存储适配层
    const savedItem = await storage.saveTripItem(tripId, itemData)
    console.log(`✅ 行程内容已保存到${STORAGE_MODE === 'supabase' ? 'Supabase数据库' : 'JSON文件'}`)
    return res.status(201).json(savedItem)

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '添加行程内容失败', details: err.message })
  }
})

// 更新行程内容 (PUT /api/trips/:tripId/items/:itemId)
app.put('/api/trips/:tripId/items/:itemId', async (req, res) => {
  try {
    const { tripId, itemId } = req.params
    const { place_name, address, description, duration, budget, notes, date, theme, sort_order, lat, lng } = req.body

    const updates = {}
    if (place_name !== undefined) updates.place_name = place_name
    if (address !== undefined) updates.address = address
    if (description !== undefined) updates.description = description
    if (duration !== undefined) updates.duration = duration
    if (budget !== undefined) updates.budget = budget
    if (notes !== undefined) updates.notes = notes
    if (date !== undefined) updates.date = date
    if (theme !== undefined) updates.theme = theme
    if (sort_order !== undefined) updates.sort_order = sort_order
    if (lat !== undefined) updates.lat = lat
    if (lng !== undefined) updates.lng = lng

    // 【重构】使用存储适配层
    try {
      const updatedItem = await storage.updateTripItem(tripId, itemId, updates)
      console.log(`✅ 行程内容已更新到${STORAGE_MODE === 'supabase' ? 'Supabase数据库' : 'JSON文件'}`)
      return res.json(updatedItem)
    } catch (fileError) {
      if (fileError.message === '行程内容不存在') {
        return res.status(404).json({ error: '行程内容不存在' })
      }
      throw fileError
    }

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '更新行程内容失败', details: err.message })
  }
})

// 删除行程内容 (DELETE /api/trips/:tripId/items/:itemId)
app.delete('/api/trips/:tripId/items/:itemId', async (req, res) => {
  try {
    const { tripId, itemId } = req.params

    // 【重构】使用存储适配层
    await storage.deleteTripItem(tripId, itemId)
    console.log(`✅ 行程内容已从${STORAGE_MODE === 'supabase' ? 'Supabase数据库' : 'JSON文件'}删除`)
    return res.json({ message: '行程内容删除成功' })

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '删除行程内容失败', details: err.message })
  }
})

// ==================== 地图API接口 ====================

// 【优化】删除重复的 /api/maps/keys 接口（与 /api/map/key 功能重复）
// 所有地图Key获取统一使用 /api/map/key 接口
// 地图Key读取统一使用 utils/mapKey.js 工具函数（getMapKeys()） 

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
    // 【优化】使用统一的mapKey工具函数
    const mapKeys = getMapKeys()
    const amapResponse = await fetch(`${amapUrl}?key=${mapKeys.amap}&location=${lng},${lat}&radius=1000&extensions=all`)
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
    if (mapKeys.google) {
      const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json`
      const googleResponse = await fetch(`${googleUrl}?key=${mapKeys.google}&latlng=${lat},${lng}`)
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
    if (mapKeys.google) {
      const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json`
      const googleResponse = await fetch(`${googleUrl}?key=${mapKeys.google}&address=${encodeURIComponent(address)}`)
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

// 【新增】地址自动匹配（POI搜索） (POST /api/maps/poi-search)
app.post('/api/maps/poi-search', async (req, res) => {
  const { keyword, city } = req.body || {}
  
  if (!keyword) {
    return res.status(400).json({ error: '请提供关键词参数' })
  }
  
  try {
    // 使用高德地图POI搜索
    const amapUrl = `https://restapi.amap.com/v3/place/text`
    const params = new URLSearchParams({
      key: mapKeys.amap,
      keywords: keyword,
      city: city || '全国',
      output: 'JSON',
      offset: '10',
      page: '1',
      extensions: 'all'
    })
    
    const amapResponse = await fetch(`${amapUrl}?${params}`)
    const amapData = await amapResponse.json()
    
    if (amapData.status === '1' && amapData.pois && amapData.pois.length > 0) {
      const results = amapData.pois.map(poi => ({
        name: poi.name,
        address: poi.address || poi.pname + poi.cityname + poi.adname,
        location: poi.location ? {
          lng: parseFloat(poi.location.split(',')[0]),
          lat: parseFloat(poi.location.split(',')[1])
        } : null,
        type: poi.type,
        tel: poi.tel || ''
      }))
      
      return res.json({
        code: 200,
        data: results,
        msg: '成功'
      })
    }
    
    return res.json({
      code: 200,
      data: [],
      msg: '未找到匹配结果'
    })
  } catch (err) {
    console.error('POI搜索失败:', err)
    return res.status(500).json({ error: 'POI搜索失败', details: err.message })
  }
})

// 【新增】大众点评POI查询接口 (POST /api/dianping/search)
app.post('/api/dianping/search', async (req, res) => {
  const { keyword } = req.body || {}
  
  if (!keyword) {
    return res.status(400).json({ error: '请提供关键词参数' })
  }
  
  try {
    // 注意：大众点评API需要申请，这里使用模拟数据或高德地图POI数据作为替代
    // 实际项目中需要接入大众点评开放平台API
    
    // 方案1：使用高德地图POI搜索获取基本信息，然后模拟大众点评数据
    const amapUrl = `https://restapi.amap.com/v3/place/text`
    const params = new URLSearchParams({
      key: mapKeys.amap,
      keywords: keyword,
      city: '全国',
      output: 'JSON',
      offset: '1',
      page: '1',
      extensions: 'all'
    })
    
    const amapResponse = await fetch(`${amapUrl}?${params}`)
    const amapData = await amapResponse.json()
    
    if (amapData.status === '1' && amapData.pois && amapData.pois.length > 0) {
      const poi = amapData.pois[0]
      
      // 模拟大众点评数据（实际项目中需要调用大众点评API）
      // 这里根据POI类型估算耗时和预算
      const type = poi.type || ''
      let duration = ''
      let budget = ''
      
      // 根据POI类型估算
      if (type.includes('景点') || type.includes('公园')) {
        duration = '2-3小时'
        budget = '50-200元'
      } else if (type.includes('餐厅') || type.includes('美食')) {
        duration = '1-2小时'
        budget = '100-300元'
      } else if (type.includes('购物') || type.includes('商场')) {
        duration = '2-4小时'
        budget = '200-1000元'
      } else if (type.includes('酒店') || type.includes('住宿')) {
        duration = '过夜'
        budget = '300-800元/晚'
      } else {
        duration = '1-2小时'
        budget = '100-300元'
      }
      
      return res.json({
        code: 200,
        data: {
          name: poi.name,
          address: poi.address || poi.pname + poi.cityname + poi.adname,
          duration: duration,
          budget: budget,
          location: poi.location ? {
            lng: parseFloat(poi.location.split(',')[0]),
            lat: parseFloat(poi.location.split(',')[1])
          } : null
        },
        msg: '成功'
      })
    }
    
    return res.json({
      code: 200,
      data: null,
      msg: '未找到该地点的信息'
    })
  } catch (err) {
    console.error('大众点评查询失败:', err)
    return res.status(500).json({ 
      code: 500,
      data: null,
      msg: '查询失败',
      error: err.message 
    })
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
    const mapKeys = getMapKeys()
    const url = `https://restapi.amap.com/v3/direction/driving?key=${mapKeys.amap}&origin=${waypoints.split('|')[0]}&destination=${waypoints.split('|')[waypoints.split('|').length - 1]}&waypoints=${waypoints.split('|').slice(1, -1).join('|')}&extensions=all`
    
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
  
  const mapKeys = getMapKeys()
  if (!mapKeys.google) {
    return res.status(400).json({ error: 'Google Maps API Key未配置' })
  }
  
  try {
    // 构建Google Maps路径规划URL
    const origin = `${coordinates[0].lat},${coordinates[0].lng}`
    const destination = `${coordinates[coordinates.length - 1].lat},${coordinates[coordinates.length - 1].lng}`
    const waypoints = coordinates.slice(1, -1).map(c => `${c.lat},${c.lng}`).join('|')
    
    let url = `https://maps.googleapis.com/maps/api/directions/json?key=${mapKeys.google}&origin=${origin}&destination=${destination}`
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
  const mapKeys = getMapKeys()
  console.log(`🚀 TripSync后端服务运行在 http://localhost:${PORT}`)
  console.log(`📝 健康检查: http://localhost:${PORT}/api/health`)
  console.log(`⚠️  请确保已配置Supabase连接信息`)
  console.log(`🗺️  地图API: 高德地图=${isMapKeyConfigured('amap') ? '已配置' : '未配置'}, Google Maps=${isMapKeyConfigured('google') ? '已配置' : '未配置'}`)
})


