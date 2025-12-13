/**
 * 收藏夹路由
 * 处理小红书链接解析、收藏保存、收藏列表
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { readJsonFile, appendToJsonArray } = require('../utils/fileUtil');
const crypto = require('crypto');

/**
 * 解析小红书链接
 * POST /api/collection/parse
 * Body: { url }
 * 
 * 注意：小红书链接解析需要爬虫或 API，这里提供简化版本
 * 实际项目中可能需要使用 puppeteer 或第三方 API
 */
router.post('/parse', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.json({
        code: 1,
        data: null,
        msg: '链接不能为空'
      });
    }

    // 验证是否为小红书链接
    if (!url.includes('xiaohongshu.com')) {
      return res.json({
        code: 1,
        data: null,
        msg: '请输入有效的小红书链接'
      });
    }

    // 简化版本：模拟解析结果
    // 实际项目中需要使用爬虫工具（如 puppeteer）或第三方 API 来解析
    // 这里返回模拟数据，开发者需要根据实际情况实现
    try {
      // 尝试获取页面内容（可能因反爬虫失败）
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 5000
      });

      // 简单解析标题和内容（实际需要更复杂的解析逻辑）
      const html = response.data;
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '未获取到标题';

      // 提取地点（简化逻辑：提取常见城市和景点关键词）
      // 实际项目应使用 NLP 或更复杂的解析逻辑
      const places = [];
      const cityPattern = /(北京|上海|广州|深圳|杭州|成都|西安|南京|武汉|重庆|天津|苏州|长沙|郑州|青岛|沈阳|大连|厦门|福州|哈尔滨|济南|石家庄|长春|昆明|合肥|南宁|太原|贵阳|呼和浩特|乌鲁木齐|拉萨|银川|西宁|海口|三亚)/g;
      const matches = html.match(cityPattern);
      if (matches) {
        places.push(...matches);
      }

      // 去重
      const uniquePlaces = [...new Set(places)];

      res.json({
        code: 0,
        data: {
          title,
          content: html.substring(0, 500), // 截取前500字符作为内容预览
          places: uniquePlaces.slice(0, 10) // 最多返回10个地点
        },
        msg: '解析成功'
      });
    } catch (parseError) {
      // 如果解析失败，返回提示信息
      console.error('解析错误:', parseError);
      res.json({
        code: 1,
        data: null,
        msg: '解析失败：小红书链接可能需要登录或存在反爬虫机制。请手动输入标题和地点信息。'
      });
    }
  } catch (error) {
    console.error('解析错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '解析失败'
    });
  }
});

/**
 * 保存收藏
 * POST /api/collection/save
 * Body: { userId, url, title, content, places }
 */
router.post('/save', async (req, res) => {
  try {
    const { userId, url, title, content, places } = req.body;

    if (!userId || !url) {
      return res.json({
        code: 1,
        data: null,
        msg: '用户ID和链接不能为空'
      });
    }

    const collectionId = crypto.randomBytes(8).toString('hex');
    const collection = {
      collectionId,
      userId,
      url,
      title: title || '未命名收藏',
      content: content || '',
      places: Array.isArray(places) ? places : [],
      createdAt: new Date().toISOString()
    };

    await appendToJsonArray('collections.json', collection);

    res.json({
      code: 0,
      data: {
        collectionId
      },
      msg: '保存成功'
    });
  } catch (error) {
    console.error('保存错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '保存失败'
    });
  }
});

/**
 * 获取收藏列表
 * GET /api/collection/list?userId=xxx
 */
router.get('/list', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.json({
        code: 1,
        data: null,
        msg: '用户ID不能为空'
      });
    }

    const collections = await readJsonFile('collections.json');
    const userCollections = collections.filter(c => c.userId === userId);

    res.json({
      code: 0,
      data: {
        collections: userCollections
      },
      msg: '获取成功'
    });
  } catch (error) {
    console.error('获取错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '获取失败'
    });
  }
});

module.exports = router;

