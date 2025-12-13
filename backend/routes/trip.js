/**
 * 行程路由
 * 处理行程生成、获取、更新
 */

const express = require('express');
const router = express.Router();
const { readJsonFile, appendToJsonArray, findJsonArrayItem, updateJsonArrayItem } = require('../utils/fileUtil');
const { generateItinerary } = require('../utils/gptUtil');
const crypto = require('crypto');

/**
 * AI 生成行程
 * POST /api/trip/generate
 * Body: { userId, collectionIds, days, budget }
 */
router.post('/generate', async (req, res) => {
  try {
    const { userId, collectionIds, days, budget } = req.body;

    if (!userId || !collectionIds || !Array.isArray(collectionIds) || collectionIds.length === 0) {
      return res.json({
        code: 1,
        data: null,
        msg: '用户ID和收藏ID列表不能为空'
      });
    }

    if (!days || days < 1) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程天数必须大于0'
      });
    }

    // 获取收藏内容
    const collections = await readJsonFile('collections.json');
    const selectedCollections = collections.filter(c => 
      collectionIds.includes(c.collectionId) && c.userId === userId
    );

    if (selectedCollections.length === 0) {
      return res.json({
        code: 1,
        data: null,
        msg: '未找到有效的收藏内容'
      });
    }

    // 调用 GPT 生成行程
    let itinerary;
    try {
      itinerary = await generateItinerary(selectedCollections, days, budget);
    } catch (gptError) {
      return res.json({
        code: 1,
        data: null,
        msg: `AI 生成失败: ${gptError.message}`
      });
    }

    // 保存行程
    const tripId = crypto.randomBytes(8).toString('hex');
    const trip = {
      tripId,
      userId,
      title: `行程-${new Date().toLocaleDateString()}`,
      collectionIds,
      days,
      budget: budget || '不限',
      itinerary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await appendToJsonArray('trips.json', trip);

    res.json({
      code: 0,
      data: {
        tripId,
        itinerary
      },
      msg: '生成成功'
    });
  } catch (error) {
    console.error('生成错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '生成失败'
    });
  }
});

/**
 * 获取用户行程列表
 * GET /api/trip/list?userId=xxx
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

    const trips = await readJsonFile('trips.json');
    const userTrips = trips.filter(t => t.userId === userId);

    res.json({
      code: 0,
      data: {
        trips: userTrips
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

/**
 * 获取行程详情
 * GET /api/trip/get?tripId=xxx
 */
router.get('/get', async (req, res) => {
  try {
    const { tripId } = req.query;

    if (!tripId) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程ID不能为空'
      });
    }

    const trip = await findJsonArrayItem('trips.json', 'tripId', tripId);

    if (!trip) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程不存在'
      });
    }

    res.json({
      code: 0,
      data: {
        trip
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

/**
 * 更新行程
 * POST /api/trip/update
 * Body: { tripId, itinerary }
 */
router.post('/update', async (req, res) => {
  try {
    const { tripId, itinerary } = req.body;

    if (!tripId || !itinerary) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程ID和行程数据不能为空'
      });
    }

    if (!Array.isArray(itinerary)) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程数据格式错误：应为数组'
      });
    }

    // 更新行程
    const success = await updateJsonArrayItem('trips.json', 'tripId', tripId, {
      itinerary,
      updatedAt: new Date().toISOString()
    });

    if (!success) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程不存在'
      });
    }

    res.json({
      code: 0,
      data: {},
      msg: '更新成功'
    });
  } catch (error) {
    console.error('更新错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '更新失败'
    });
  }
});

module.exports = router;

