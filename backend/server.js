import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import axios from 'axios'
import * as cheerio from 'cheerio'
import puppeteer from 'puppeteer'
import { supabase } from './config/supabase.js'

// 加载环境变量
dotenv.config()

// 创建Express应用
const app = express()
const PORT = process.env.PORT || 3001

// 中间件配置
app.use(cors()) // 允许跨域请求
app.use(express.json()) // 解析JSON请求体



// ==================== 路由定义 ====================

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TripSync后端服务运行正常' })
})

// ==================== 攻略CRUD接口 ====================

// 获取所有攻略 (GET /api/guides)
app.get('/api/guides', async (req, res) => {
  try {
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
 * POST /api/xhs/parse
 * 请求体: { url: 'https://www.xiaohongshu.com/explore/xxxx' }
 * 返回: { name, address, average, keywords, images }
 * 
 * 使用 Puppeteer 无头浏览器解析小红书页面，支持动态加载的内容
 */
app.post('/api/xhs/parse', async (req, res) => {
  const { url } = req.body || {}

  // 参数校验
  if (!url) {
    return res.status(400).json({ error: '请提供小红书链接参数 url' })
  }

  // 确保URL带协议
  const targetUrl = url.startsWith('http') ? url : `https://${url}`

  // 浏览器实例，用于最后关闭
  let browser = null

  try {
    console.log('🚀 开始解析小红书链接:', targetUrl)

    // 步骤1: 启动 Puppeteer 浏览器
    browser = await puppeteer.launch({
      headless: true, // 无头模式，不显示浏览器窗口
      args: [
        '--no-sandbox', // 避免权限问题
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage' // 避免内存问题
      ]
    })

    // 步骤2: 创建新页面
    const page = await browser.newPage()

    // 步骤3: 设置 User-Agent，模拟真实 Chrome 浏览器
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    // 步骤4: 访问目标页面
    await page.goto(targetUrl, {
      waitUntil: 'networkidle0', // 等待网络请求完成，确保页面完全加载
      timeout: 30000 // 30秒超时
    })

    // 步骤5: 等待页面内容加载（额外等待2秒，确保动态内容加载完成）
    await page.waitForTimeout(2000)

    // 步骤6: 提取页面文字信息（标题、描述等）
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
      
      // 提取页面文本内容（用于匹配地址、人均等）
      const textContent = document.body ? document.body.innerText : ''
      
      return {
        title,
        description,
        keywordsMeta,
        textContent
      }
    })

    // 步骤7: 提取图片链接（从页面中查找所有图片）
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

    // 步骤8: 解析文字信息
    const name = pageData.title.split('|')[0].trim() || ''
    
    // 地址匹配：尝试多种格式
    const address = pickByRegex(pageData.textContent, [
      /地址[:：]\s*([^\n<]+)/i,
      /位置[:：]\s*([^\n<]+)/i,
      /地点[:：]\s*([^\n<]+)/i
    ])

    // 人均匹配
    const average = pickByRegex(pageData.textContent, [
      /人均[:：]\s*([0-9]+\.?[0-9]*\s*元?)/i,
      /平均消费[:：]\s*([0-9]+\.?[0-9]*\s*元?)/i
    ])

    // 体验关键词：优先 keywords meta，其次拆分描述
    const keywords = (pageData.keywordsMeta || pageData.description)
      .split(/[，,\/]/)
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 6)

    // 步骤9: 处理图片数组（去重、过滤、只取前3张）
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

    // 步骤10: 关闭浏览器，释放资源
    await browser.close()
    browser = null

    // 步骤11: 返回结果
    return res.json({
      name,
      address,
      average,
      keywords,
      images: uniqueImages, // 图片链接数组（最多3张）
      raw: {
        title: pageData.title,
        description: pageData.description
      }
    })

  } catch (error) {
    // 错误处理：确保浏览器被关闭
    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.error('关闭浏览器失败:', closeError)
      }
    }

    console.error('❌ 小红书解析失败:', error?.message || error)
    
    // 返回友好的错误提示
    return res.status(500).json({
      error: '解析小红书链接失败，请检查链接是否有效或稍后重试',
      details: error?.message || '未知错误'
    })
  }
})

// ==================== 启动服务器 ====================
app.listen(PORT, () => {
  console.log(`🚀 TripSync后端服务运行在 http://localhost:${PORT}`)
  console.log(`📝 健康检查: http://localhost:${PORT}/api/health`)
  console.log(`⚠️  请确保已配置Supabase连接信息`)
})


