import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import axios from 'axios'
import * as cheerio from 'cheerio'
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
const PORT = process.env.PORT || 3001

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
    // 【修复4】检查supabase是否可用
    if (!supabase) {
      return res.json([]) // 如果未配置，返回空数组
    }
    
    // 从Supabase查询所有攻略
    const { data, error } = await supabase
      .from('guides')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('查询攻略失败:', error)
      return res.status(500).json({ error: '获取攻略列表失败', details: error.message })
    }

    res.json(data || [])
  } catch (err) {
    console.error('服务器错误:', err)
    res.status(500).json({ error: '服务器内部错误', details: err.message })
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

// 伪装请求头，降低被反爬拦截的概率
const XHS_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  Referer: 'https://www.xiaohongshu.com'
}

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
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ]
  return userAgents[Math.floor(Math.random() * userAgents.length)]
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

    // 步骤6: 【关键修改5】访问目标页面（60秒超时）
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded', // DOM内容加载完成即可，比 networkidle0 快很多
      timeout: 60000 // 60秒超时
    })
    
    // 步骤7: 【关键修改6】等待页面内容加载（使用 Promise，替代已废弃的 waitForTimeout）
    // 等待动态内容加载完成
    await new Promise(resolve => setTimeout(resolve, 3000))

    // 步骤7: 【修复2】提取页面文字信息（标题、描述、原始文本内容等）
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
      
      // 【修复2-1】提取页面文本内容（用于匹配地址、人均等）
      let textContent = ''
      if (document.body) {
        // 方法1: 使用 innerText（推荐，会忽略隐藏元素）
        textContent = document.body.innerText || ''
        // 方法2: 如果 innerText 为空，尝试 textContent
        if (!textContent || textContent.trim().length < 10) {
          textContent = document.body.textContent || ''
        }
        // 方法3: 尝试从主要内容区域提取
        const mainContent = document.querySelector('main') || 
                           document.querySelector('.content') || 
                           document.querySelector('#app') ||
                           document.querySelector('.note-content') ||
                           document.querySelector('[class*="content"]')
        if (mainContent) {
          const mainText = mainContent.innerText || mainContent.textContent || ''
          if (mainText && mainText.length > textContent.length) {
            textContent = mainText
          }
        }
      }
      
      // 【修复2-2】提取原始摘要（笔记的完整文本内容）
      let rawContent = ''
      // 方法1: 优先使用描述
      if (description && description.trim().length > 10) {
        rawContent = description
      }
      // 方法2: 如果描述为空或太短，使用页面文本内容
      if (!rawContent || rawContent.length < 50) {
        // 尝试从笔记内容区域提取
        const noteContent = document.querySelector('.note-content') ||
                           document.querySelector('[class*="note"]') ||
                           document.querySelector('[class*="content"]') ||
                           document.querySelector('article') ||
                           document.querySelector('.desc')
        
        if (noteContent) {
          rawContent = noteContent.innerText || noteContent.textContent || ''
        }
        
        // 如果还是为空，使用整个body的文本（但限制长度）
        if (!rawContent || rawContent.length < 50) {
          rawContent = textContent.substring(0, 2000) // 限制长度，避免太长
        }
      }
      
      // 如果都没有，至少返回标题
      if (!rawContent && title) {
        rawContent = title
      }
      
      return {
        title,
        description,
        keywordsMeta,
        textContent: textContent || '',
        rawContent: rawContent || '' // 新增：原始摘要内容
      }
    })

    // 调试日志：输出提取到的文本内容长度
    console.log(`📝 提取到文本内容长度: ${pageData.textContent.length} 字符`)
    console.log(`📝 标题: ${pageData.title}`)
    console.log(`📝 描述: ${pageData.description ? pageData.description.substring(0, 100) : '无'}...`)
    console.log(`📝 原始摘要长度: ${pageData.rawContent ? pageData.rawContent.length : 0} 字符`)
    console.log(`📝 原始摘要预览: ${pageData.rawContent ? pageData.rawContent.substring(0, 150) : '无'}...`)

    // 步骤8: 提取图片链接（从页面中查找所有图片）
    const images = await page.evaluate(() => {
      const imageUrls = []
      
      // 方法1: 从 og:image meta 标签提取
      const ogImageElement = document.querySelector('meta[property="og:image"]')
      if (ogImageElement) {
        const ogImageUrl = ogImageElement.getAttribute('content')
        // 检查是否包含 sns-img-qc.xiaohongshu.com 域名
        if (ogImageUrl && ogImageUrl.indexOf('sns-img-qc.xiaohongshu.com') !== -1) {
          imageUrls.push(ogImageUrl)
        }
      }
      
      // 方法2: 从所有 img 标签提取
      const imgElements = document.querySelectorAll('img')
      for (let i = 0; i < imgElements.length; i++) {
        const img = imgElements[i]
        // 优先取 data-src（懒加载），其次取 src
        const imgSrc = img.getAttribute('data-src') || img.getAttribute('src')
        // 检查是否包含 sns-img-qc.xiaohongshu.com 域名
        if (imgSrc && imgSrc.indexOf('sns-img-qc.xiaohongshu.com') !== -1) {
          imageUrls.push(imgSrc)
        }
      }
      
      return imageUrls
    })

    // 步骤9: 解析文字信息
    // 解析名称：从标题中提取，去掉可能的后缀
    let name = ''
    if (pageData.title) {
      name = pageData.title.split('|')[0].split('-')[0].split('_')[0].trim()
    }
    // 如果标题为空，尝试从描述中提取
    if (!name && pageData.description) {
      name = pageData.description.substring(0, 50).trim()
    }
    
    // 地址匹配：尝试多种格式
    let address = pickByRegex(pageData.textContent, [
      /地址[:：]\s*([^\n\r<]+)/i,
      /位置[:：]\s*([^\n\r<]+)/i,
      /地点[:：]\s*([^\n\r<]+)/i,
      /📍\s*([^\n\r<]+)/i,
      /地址[：:]\s*([^\n\r<]+)/i
    ])
    
    // 如果从文本中没找到，尝试从描述中找
    if (!address && pageData.description) {
      address = pickByRegex(pageData.description, [
        /地址[:：]\s*([^\n\r<]+)/i,
        /位置[:：]\s*([^\n\r<]+)/i
      ])
    }

    // 人均匹配：尝试多种格式
    let average = pickByRegex(pageData.textContent, [
      /人均[:：]\s*([0-9]+\.?[0-9]*\s*元?)/i,
      /平均消费[:：]\s*([0-9]+\.?[0-9]*\s*元?)/i,
      /💰\s*人均[:：]?\s*([0-9]+\.?[0-9]*\s*元?)/i,
      /人均[：:]\s*([0-9]+\.?[0-9]*)/i
    ])
    
    // 如果从文本中没找到，尝试从描述中找
    if (!average && pageData.description) {
      average = pickByRegex(pageData.description, [
        /人均[:：]\s*([0-9]+\.?[0-9]*\s*元?)/i,
        /平均消费[:：]\s*([0-9]+\.?[0-9]*\s*元?)/i
      ])
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
    console.log(`✅ 解析结果 - 名称: ${name || '未提取到'}`)
    console.log(`✅ 解析结果 - 地址: ${address || '未提取到'}`)
    console.log(`✅ 解析结果 - 人均: ${average || '未提取到'}`)
    console.log(`✅ 解析结果 - 关键词数量: ${keywords.length}`)

    // 步骤10: 处理图片数组（去重、过滤、只取前3张）
    const uniqueImages = []
    const seenImages = new Set()
    
    for (let i = 0; i < images.length; i++) {
      const imgUrl = images[i] ? images[i].trim() : ''
      // 只保留包含 sns-img-qc.xiaohongshu.com 域名的图片，且去重
      if (imgUrl && imgUrl.indexOf('sns-img-qc.xiaohongshu.com') !== -1 && !seenImages.has(imgUrl)) {
        seenImages.add(imgUrl)
        uniqueImages.push(imgUrl)
        // 只取前3张
        if (uniqueImages.length >= 3) {
          break
        }
      }
    }

    console.log(`✅ 解析成功，提取到 ${uniqueImages.length} 张图片`)

    // 步骤11: 关闭浏览器，释放资源
    await browser.close()
    browser = null

    // 步骤12: 【修复2-3】构建返回结果，确保所有字段都有值（包括原始摘要）
    const result = {
      name: name || '',
      address: address || '',
      average: average || '',
      keywords: keywords || [],
      images: uniqueImages || [],
      raw: {
        title: pageData.title || '',
        description: pageData.description || '',
        content: pageData.rawContent || pageData.description || pageData.textContent.substring(0, 500) || '' // 【修复2-4】原始摘要：优先使用rawContent，其次description，最后textContent
      }
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
 * 返回: { name, address, average, keywords, images }
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
    const data = fs.readFileSync(SITES_JSON_PATH, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('读取JSON文件失败:', error)
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

// 保存站点到数据库 (POST /api/xhs/sites)
app.post('/api/xhs/sites', async (req, res) => {
  try {
    const { site_name, xhs_url, content, images, tags, notes } = req.body

    // 验证必填字段
    if (!site_name || !xhs_url) {
      return res.status(400).json({ error: '站点名称和小红书链接为必填项' })
    }

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
              images: images || [],
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
      images: images || [],
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

    const { data, error } = await supabase
      .from('xhs_sites')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('查询站点失败:', error)
      return res.status(404).json({ error: '站点不存在', details: error.message })
    }

    res.json(data)
  } catch (err) {
    console.error('服务器错误:', err)
    res.status(500).json({ error: '服务器内部错误', details: err.message })
  }
})

// 更新站点信息 (PUT /api/xhs/sites/:id)
app.put('/api/xhs/sites/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { site_name, content, images, tags, notes } = req.body

    // 构建更新对象
    const updates = {}
    if (site_name) updates.site_name = site_name
    if (content !== undefined) updates.content = content
    if (images !== undefined) updates.images = images
    if (tags !== undefined) updates.tags = tags
    if (notes !== undefined) updates.notes = notes
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('xhs_sites')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('更新站点失败:', error)
      return res.status(500).json({ error: '更新站点失败', details: error.message })
    }

    if (!data) {
      return res.status(404).json({ error: '站点不存在' })
    }

    res.json(data)
  } catch (err) {
    console.error('服务器错误:', err)
    res.status(500).json({ error: '服务器内部错误', details: err.message })
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
    // 【修复11】检查Supabase是否配置且可用
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        return res.json(data || [])
      } catch (dbError) {
        console.warn('⚠️ Supabase查询失败，切换到JSON文件:', dbError.message)
      }
    }

    // 使用JSON文件
    const trips = readTripsFromFile()
    trips.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    return res.json(trips || [])

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '查询行程列表失败', details: err.message })
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

    return res.json({
      ...trip,
      sites: tripSites
    })

  } catch (err) {
    console.error('服务器错误:', err)
    return res.status(500).json({ error: '查询行程失败', details: err.message })
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
        return res.json({ message: '行程删除成功' })
      } catch (dbError) {
        console.warn('⚠️ Supabase删除失败，切换到JSON文件:', dbError.message)
      }
    }

    // 使用JSON文件
    deleteTripFromFile(id)
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

// ==================== 启动服务器 ====================
app.listen(PORT, () => {
  console.log(`🚀 TripSync后端服务运行在 http://localhost:${PORT}`)
  console.log(`📝 健康检查: http://localhost:${PORT}/api/health`)
  console.log(`⚠️  请确保已配置Supabase连接信息`)
})


