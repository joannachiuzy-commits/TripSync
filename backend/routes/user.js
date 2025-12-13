/**
 * 用户路由
 * 处理用户注册、登录
 */

const express = require('express');
const router = express.Router();
const { readJsonFile, appendToJsonArray, findJsonArrayItem } = require('../utils/fileUtil');
const crypto = require('crypto');

/**
 * 获取用户ID（支持userId和guestId）
 * @param {Object} req 请求对象
 * @returns {string|null} 用户ID
 */
function getUserId(req) {
  // 优先从body获取，其次从query获取
  return req.body.userId || req.body.guestId || req.query.userId || req.query.guestId || null;
}

/**
 * 创建或获取游客用户
 * @param {string} guestId 游客ID
 * @returns {Promise<Object>} 游客用户对象
 */
async function getOrCreateGuestUser(guestId) {
  const users = await readJsonFile('users.json');
  let guestUser = users.find(u => u.userId === guestId && u.userType === 'guest');
  
  if (!guestUser) {
    // 创建新的游客用户
    guestUser = {
      userId: guestId,
      nickname: '游客',
      userType: 'guest',
      createdAt: new Date().toISOString()
    };
    await appendToJsonArray('users.json', guestUser);
  }
  
  return guestUser;
}

/**
 * 用户注册
 * POST /api/user/register
 * Body: { nickname, password }
 */
router.post('/register', async (req, res) => {
  try {
    const { nickname, password } = req.body;

    if (!nickname || !password) {
      return res.json({
        code: 1,
        data: null,
        msg: '昵称和密码不能为空'
      });
    }

    // 检查用户是否已存在（昵称唯一性校验）
    const users = await readJsonFile('users.json');
    const existingUser = users.find(u => u.nickname === nickname && u.userType !== 'guest');
    
    if (existingUser) {
      return res.json({
        code: 1,
        data: null,
        msg: '该昵称已存在，请使用其他昵称'
      });
    }

    // 生成用户ID和密码哈希（简化处理，实际应使用 bcrypt）
    const userId = crypto.randomBytes(8).toString('hex');
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    const newUser = {
      userId,
      nickname,
      passwordHash,
      userType: 'formal', // 标记为正式用户
      createdAt: new Date().toISOString()
    };

    await appendToJsonArray('users.json', newUser);

    res.json({
      code: 0,
      data: {
        userId,
        nickname
      },
      msg: '注册成功'
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '注册失败'
    });
  }
});

/**
 * 用户登录
 * POST /api/user/login
 * Body: { nickname, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { nickname, password } = req.body;

    if (!nickname || !password) {
      return res.json({
        code: 1,
        data: null,
        msg: '昵称和密码不能为空'
      });
    }

    // 查找用户
    const users = await readJsonFile('users.json');
    const user = users.find(u => u.nickname === nickname);

    if (!user) {
      return res.json({
        code: 1,
        data: null,
        msg: '用户不存在'
      });
    }

    // 游客用户不能通过此接口登录
    if (user.userType === 'guest') {
      return res.json({
        code: 1,
        data: null,
        msg: '游客用户无法登录，请先注册账号'
      });
    }

    // 验证密码
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    if (user.passwordHash !== passwordHash) {
      return res.json({
        code: 1,
        data: null,
        msg: '密码错误'
      });
    }

    // 生成 token（简化处理，实际应使用 JWT）
    const token = crypto.randomBytes(16).toString('hex');

    res.json({
      code: 0,
      data: {
        userId: user.userId,
        nickname: user.nickname,
        token
      },
      msg: '登录成功'
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '登录失败'
    });
  }
});

// 导出工具函数供其他路由使用
module.exports = router;
module.exports.getUserId = getUserId;
module.exports.getOrCreateGuestUser = getOrCreateGuestUser;

