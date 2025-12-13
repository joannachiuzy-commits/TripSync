/**
 * 协作分享路由
 * 处理分享链接创建、验证
 */

const express = require('express');
const router = express.Router();
const { readJsonFile, appendToJsonArray } = require('../utils/fileUtil');
const { generateShareLink, verifyShareLink } = require('../utils/shareUtil');

/**
 * 创建分享链接
 * POST /api/share/create
 * Body: { tripId, permission }
 */
router.post('/create', async (req, res) => {
  try {
    const { tripId, permission } = req.body;

    if (!tripId) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程ID不能为空'
      });
    }

    if (permission !== 'edit' && permission !== 'read') {
      return res.json({
        code: 1,
        data: null,
        msg: '权限类型错误：应为 edit 或 read'
      });
    }

    // 验证行程是否存在
    const trips = await readJsonFile('trips.json');
    const trip = trips.find(t => t.tripId === tripId);

    if (!trip) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程不存在'
      });
    }

    // 生成分享链接
    const shareLink = generateShareLink(tripId, permission);

    // 保存分享记录
    const share = {
      shareLink,
      tripId,
      permission,
      createdAt: new Date().toISOString()
    };

    await appendToJsonArray('shares.json', share);

    res.json({
      code: 0,
      data: {
        shareLink
      },
      msg: '创建成功'
    });
  } catch (error) {
    console.error('创建分享链接错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '创建失败'
    });
  }
});

/**
 * 验证分享链接
 * POST /api/share/verify
 * Body: { shareLink }
 */
router.post('/verify', async (req, res) => {
  try {
    const { shareLink } = req.body;

    if (!shareLink) {
      return res.json({
        code: 1,
        data: null,
        msg: '分享链接不能为空'
      });
    }

    // 验证链接格式
    const linkInfo = verifyShareLink(shareLink);

    if (!linkInfo) {
      return res.json({
        code: 1,
        data: null,
        msg: '无效的分享链接'
      });
    }

    // 验证行程是否存在
    const trips = await readJsonFile('trips.json');
    const trip = trips.find(t => t.tripId === linkInfo.tripId);

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
        tripId: linkInfo.tripId,
        permission: linkInfo.permission,
        trip
      },
      msg: '验证成功'
    });
  } catch (error) {
    console.error('验证分享链接错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '验证失败'
    });
  }
});

module.exports = router;

