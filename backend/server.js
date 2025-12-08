import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
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

// ==================== 启动服务器 ====================
app.listen(PORT, () => {
  console.log(`🚀 TripSync后端服务运行在 http://localhost:${PORT}`)
  console.log(`📝 健康检查: http://localhost:${PORT}/api/health`)
  console.log(`⚠️  请确保已配置Supabase连接信息`)
})


