/**
 * 用户路由
 * 处理用户注册、登录
 */

const express = require('express');
const router = express.Router();
const { readJsonFile, appendToJsonArray, findJsonArrayItem } = require('../utils/fileUtil');
const crypto = require('crypto');

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

    // 检查用户是否已存在
    const users = await readJsonFile('users.json');
    const existingUser = users.find(u => u.nickname === nickname);
    
    if (existingUser) {
      return res.json({
        code: 1,
        data: null,
        msg: '该昵称已存在'
      });
    }

    // 生成用户ID和密码哈希（简化处理，实际应使用 bcrypt）
    const userId = crypto.randomBytes(8).toString('hex');
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    const newUser = {
      userId,
      nickname,
      passwordHash,
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

module.exports = router;

