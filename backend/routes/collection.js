/**
 * 收藏夹路由
 * 处理小红书链接解析、收藏保存、收藏列表
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { readJsonFile, appendToJsonArray, updateJsonArrayItem } = require('../utils/fileUtil');
const { getOrCreateGuestUser } = require('./user');
const { extractTagsByGPT } = require('../utils/gptTagExtractor');
const crypto = require('crypto');

/**
 * 获取用户ID（支持userId和guestId）
 * @param {Object} req 请求对象
 * @returns {string|null} 用户ID
 */
function getUserId(req) {
  return req.body.userId || req.body.guestId || req.query.userId || req.query.guestId || null;
}

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

    // 解析小红书链接：从页面初始数据中提取笔记正文、标题和地点
    // 注意：小红书笔记是动态渲染的，正文存储在页面的初始数据（如__INITIAL_STATE__）中
    // 实际项目中建议使用 puppeteer 或第三方 API 来更好地处理动态内容
    
    // 优化：请求重试机制
    const maxRetries = 3;
    let response = null;
    let html = null;
    
    // 内层try块：包裹整个解析逻辑，用于捕获解析过程中的错误
    try {
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 添加延迟，模拟真实用户行为（避免请求过快）
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, (attempt - 1) * 1000));
        }
        
        console.log(`[小红书解析] 尝试获取页面内容 (第${attempt}次)`);
        
        // 优化：更真实的浏览器请求头，模拟真实用户行为
        response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://www.xiaohongshu.com/',
            'Origin': 'https://www.xiaohongshu.com',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Cache-Control': 'max-age=0'
          },
          timeout: 15000
        });
        
        html = response.data;
        console.log(`[小红书解析] 成功获取页面内容 (${html.length} 字符)`);
        break;
      } catch (requestError) {
        console.warn(`[小红书解析] 第${attempt}次请求失败:`, requestError.message);
        if (attempt === maxRetries) {
          throw new Error(`获取页面失败（已重试${maxRetries}次）: ${requestError.message}`);
        }
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }

    if (!html) {
      throw new Error('无法获取页面内容');
    }
      
      let title = '未获取到标题';
      let contentText = '无法获取笔记正文';
      let places = [];
      let noteData = null;

      // 步骤1：从页面的script标签中提取初始数据（小红书笔记数据通常在这里）
      // 优化：增强初始数据提取能力，支持更多可能的变量名和格式
      console.log('[小红书解析] 开始提取初始数据...');
      
      const scriptPatterns = [
        // 格式1: window.__INITIAL_STATE__ = {...}
        /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/,
        // 格式2: __INITIAL_STATE__ = {...}
        /__INITIAL_STATE__\s*=\s*({[\s\S]*?});/,
        // 格式3: window.__NOTE_INFO__ = {...}
        /window\.__NOTE_INFO__\s*=\s*({[\s\S]*?});/,
        // 格式4: window.__REDUX_STATE__ = {...} (Redux状态)
        /window\.__REDUX_STATE__\s*=\s*({[\s\S]*?});/,
        // 格式5: window.__APP_INITIAL_STATE__ = {...}
        /window\.__APP_INITIAL_STATE__\s*=\s*({[\s\S]*?});/,
        // 格式6: window.__PRELOADED_STATE__ = {...}
        /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});/,
        // 格式7: 包含noteInfo的script标签内容（更宽松的匹配）
        /<script[^>]*>[\s\S]*?(window\.__INITIAL_STATE__|__INITIAL_STATE__|window\.__NOTE_INFO__|window\.__REDUX_STATE__)\s*=\s*({[\s\S]*?});[\s\S]*?<\/script>/i,
        // 格式8: 查找包含"noteInfo"或"note"关键词的script标签
        /<script[^>]*>[\s\S]*?["']noteInfo["'][\s\S]*?({[\s\S]{100,50000}?})[\s\S]*?<\/script>/i
      ];

      for (let i = 0; i < scriptPatterns.length; i++) {
        const pattern = scriptPatterns[i];
        const match = html.match(pattern);
        if (match) {
          try {
            // 提取JSON字符串（可能是match[1]或match[2]，取决于正则表达式）
            let jsonStr = match[1] || match[2];
            if (!jsonStr) continue;
            
            // 优化：处理JSON字符串中的常见问题
            // 1. 移除可能的注释
            jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, '');
            jsonStr = jsonStr.replace(/\/\/.*$/gm, '');
            
            // 2. 处理可能的尾随逗号（在某些JSON变体中）
            jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
            
            // 3. 尝试修复不完整的JSON（如果以{开头但可能被截断）
            if (jsonStr.startsWith('{') && !jsonStr.endsWith('}')) {
              // 尝试找到最后一个完整的对象
              let braceCount = 0;
              let lastValidPos = -1;
              for (let j = 0; j < jsonStr.length; j++) {
                if (jsonStr[j] === '{') braceCount++;
                if (jsonStr[j] === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    lastValidPos = j;
                  }
                }
              }
              if (lastValidPos > 0) {
                jsonStr = jsonStr.substring(0, lastValidPos + 1);
              }
            }
            
            noteData = JSON.parse(jsonStr);
            console.log(`[小红书解析] 成功提取初始数据 (使用模式${i + 1})`);
            break;
          } catch (parseError) {
            // JSON解析失败，尝试下一个模式
            console.warn(`[小红书解析] JSON解析失败 (模式${i + 1}):`, parseError.message.substring(0, 100));
            continue;
          }
        }
      }
      
      if (!noteData) {
        console.warn('[小红书解析] 未能从script标签提取初始数据，将使用降级方案');
      }

      // 步骤2：从初始数据中提取笔记信息
      // 优化：增强数据路径多样性，应对不同页面结构
      if (noteData) {
        console.log('[小红书解析] 开始从初始数据中提取笔记信息...');
        
        // 尝试多种可能的数据路径
        let note = null;
        const dataPaths = [
          // 路径1: noteData.noteInfo.note
          () => noteData.noteInfo?.note,
          // 路径2: noteData.note
          () => noteData.note,
          // 路径3: noteData.data.note
          () => noteData.data?.note,
          // 路径4: noteData.noteInfo
          () => noteData.noteInfo,
          // 路径5: noteData.data.noteInfo
          () => noteData.data?.noteInfo,
          // 路径6: noteData.page.noteInfo
          () => noteData.page?.noteInfo,
          // 路径7: noteData.page.noteInfo.note
          () => noteData.page?.noteInfo?.note,
          // 路径8: noteData.entities.note (如果使用实体存储)
          () => {
            if (noteData.entities && noteData.entities.note) {
              const noteIds = Object.keys(noteData.entities.note);
              return noteIds.length > 0 ? noteData.entities.note[noteIds[0]] : null;
            }
            return null;
          },
          // 路径9: noteData.entities.noteInfo
          () => {
            if (noteData.entities && noteData.entities.noteInfo) {
              const noteInfoIds = Object.keys(noteData.entities.noteInfo);
              return noteInfoIds.length > 0 ? noteData.entities.noteInfo[noteInfoIds[0]] : null;
            }
            return null;
          }
        ];
        
        // 尝试所有路径
        for (let i = 0; i < dataPaths.length; i++) {
          try {
            const result = dataPaths[i]();
            if (result && (result.title || result.content || result.desc)) {
              note = result;
              console.log(`[小红书解析] 从数据路径${i + 1}成功提取笔记对象`);
              break;
            }
          } catch (err) {
            console.warn(`[小红书解析] 数据路径${i + 1}访问失败:`, err.message);
          }
        }
        
        // 路径10: 递归搜索包含title和content的对象（最后的尝试）
        if (!note) {
          console.log('[小红书解析] 使用递归搜索查找笔记对象...');
          const searchForNote = (obj, depth = 0, maxDepth = 5) => {
            if (depth > maxDepth) return null;
            if (typeof obj !== 'object' || obj === null) return null;
            
            // 检查是否包含笔记特征
            const hasTitle = obj.title || obj.name || obj.noteTitle;
            const hasContent = obj.content || obj.desc || obj.rawContent || obj.text || obj.note;
            
            if (hasTitle && hasContent) {
              return obj;
            }
            
            // 递归搜索
            for (const key in obj) {
              if (key === 'note' || key === 'noteInfo' || key.includes('note') || key.includes('content')) {
                const result = searchForNote(obj[key], depth + 1, maxDepth);
                if (result) return result;
              }
            }
            
            return null;
          };
          note = searchForNote(noteData);
          if (note) {
            console.log('[小红书解析] 通过递归搜索找到笔记对象');
          }
        }

        if (note) {
          // 提取标题（优化：支持更多字段名）
          title = note.title || note.name || note.noteTitle || note.displayTitle || title;
          if (title && title !== '未获取到标题') {
            // 清理标题中的多余信息
            title = title
              .replace(/[-_|].*?小红书.*?$/i, '')
              .replace(/[-_|].*?你的生活兴趣社区.*?$/i, '')
              .trim();
            console.log(`[小红书解析] 提取标题: ${title.substring(0, 50)}...`);
          }
          
          // 提取正文（优化：支持更多字段名和格式）
          const contentFields = [
            'content', 'desc', 'rawContent', 'text', 'note', 
            'description', 'noteContent', 'body', 'detail',
            'summary', 'abstract', 'markdown', 'html'
          ];
          
          for (const field of contentFields) {
            if (note[field]) {
              contentText = note[field];
              console.log(`[小红书解析] 从字段"${field}"提取正文`);
              break;
            }
          }
          
          // 如果contentText是数组（可能包含多个段落），合并为字符串
          if (Array.isArray(contentText)) {
            contentText = contentText.map(item => {
              if (typeof item === 'string') return item;
              if (item && item.text) return item.text;
              if (item && item.content) return item.content;
              if (item && item.type === 'text' && item.value) return item.value;
              return '';
            }).filter(Boolean).join('\n');
          }
          
          // 如果contentText是对象，尝试提取文本
          if (typeof contentText === 'object' && contentText !== null) {
            if (contentText.text) {
              contentText = contentText.text;
            } else if (contentText.value) {
              contentText = contentText.value;
            } else if (Array.isArray(contentText.blocks)) {
              // 处理块状内容（如富文本编辑器格式）
              contentText = contentText.blocks.map(block => {
                if (block.text) return block.text;
                if (block.content) return block.content;
                return '';
              }).filter(Boolean).join('\n');
            }
          }
          
          // 提取地点（优化：支持更多格式）
          if (note.locations && Array.isArray(note.locations)) {
            places = note.locations.map(loc => {
              if (typeof loc === 'string') return loc;
              if (loc && loc.name) return loc.name;
              if (loc && loc.location) return loc.location;
              if (loc && loc.title) return loc.title;
              if (loc && loc.address) return loc.address;
              return '';
            }).filter(Boolean);
          } else if (note.location) {
            places = typeof note.location === 'string' 
              ? [note.location] 
              : [note.location.name || note.location.location || ''].filter(Boolean);
          } else if (note.poiList && Array.isArray(note.poiList)) {
            // 从POI列表中提取地点
            places = note.poiList.map(poi => poi.name || poi.title || '').filter(Boolean);
          }
          
          if (contentText && contentText !== '无法获取笔记正文') {
            console.log(`[小红书解析] 成功提取笔记信息 - 标题: ${title.substring(0, 30)}..., 正文长度: ${contentText.length}, 地点数: ${places.length}`);
          }
        } else {
          console.warn('[小红书解析] 从初始数据中未找到笔记对象');
        }
      }

      // 步骤3：降级方案 - 如果无法从初始数据提取，尝试从DOM节点提取
      // 优化：强化降级提取方案，更新DOM选择器，适配最新页面结构
      if (!noteData || contentText === '无法获取笔记正文') {
        console.warn('[小红书解析] 无法从初始数据提取，使用降级方案从DOM节点提取');
        
        // 提取标题（从title标签和meta标签）
        if (title === '未获取到标题') {
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) {
            title = titleMatch[1]
              .replace(/[-_|].*?小红书.*?$/i, '')
              .replace(/[-_|].*?你的生活兴趣社区.*?$/i, '')
              .trim();
          }
          
          // 尝试从meta标签提取
          if (title === '未获取到标题') {
            const metaTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
            if (metaTitleMatch) {
              title = metaTitleMatch[1].trim();
            }
          }
        }

        // 优化：更新DOM选择器，适配最新页面结构，增加更多内容提取规则
        const contentSelectors = [
          // 新的选择器（适配最新页面结构）
          /<div[^>]*class="[^"]*note-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*class="[^"]*content-wrapper[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*class="[^"]*desc[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*class="[^"]*note-desc[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*class="[^"]*rich-text[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*class="[^"]*text-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*class="[^"]*note-text[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*data-v-[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<p[^>]*class="[^"]*note-content[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
          /<p[^>]*class="[^"]*desc[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
          /<span[^>]*class="[^"]*note-content[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
          // 通过data属性查找
          /<div[^>]*data-note-content[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*data-content[^>]*>([\s\S]*?)<\/div>/i,
          // 通过id查找
          /<div[^>]*id="[^"]*note-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i
        ];
        
        for (let i = 0; i < contentSelectors.length; i++) {
          const selector = contentSelectors[i];
          const match = html.match(selector);
          if (match && match[1]) {
            const rawContent = match[1];
            
            // 优化：改进HTML清理逻辑，避免提取无效内容
            let extracted = rawContent
              // 移除script和style标签及其内容
              .replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<style[\s\S]*?<\/style>/gi, '')
              // 移除noscript标签
              .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
              // 移除注释
              .replace(/<!--[\s\S]*?-->/g, '')
              // 移除所有HTML标签
              .replace(/<[^>]+>/g, ' ')
              // 替换HTML实体
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&apos;/g, "'")
              .replace(/&#x27;/g, "'")
              .replace(/&#x2F;/g, '/')
              // 清理多余空白
              .replace(/\s+/g, ' ')
              .trim();
            
            // 验证提取的内容是否有效（避免提取到导航、广告等无效内容）
            const invalidPatterns = [
              /^(首页|登录|注册|搜索|菜单|导航|广告|cookie|隐私|政策)/i,
              /^(首页|登录|注册|搜索|菜单|导航|广告|cookie|隐私|政策).{0,20}$/i
            ];
            
            const isValid = extracted.length > 20 && 
                           !invalidPatterns.some(pattern => pattern.test(extracted)) &&
                           !extracted.match(/^[\s\W]*$/) && // 不是纯符号
                           extracted.match(/[\u4e00-\u9fa5a-zA-Z]/); // 包含中文或英文
            
            if (isValid) {
              contentText = extracted;
              console.log(`[小红书解析] 从DOM选择器${i + 1}成功提取正文 (${extracted.length}字符)`);
              break;
            } else {
              console.warn(`[小红书解析] DOM选择器${i + 1}提取的内容无效，跳过`);
            }
          }
        }
        
        // 如果仍未提取到，尝试从整个HTML中提取文本（最后的降级方案）
        if (contentText === '无法获取笔记正文') {
          console.warn('[小红书解析] 所有DOM选择器均失败，尝试从整个HTML提取文本');
          let cleanHtml = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
            .replace(/<!--[\s\S]*?-->/g, '');
          
          contentText = cleanHtml
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
          
          // 如果内容太长，截取中间部分（通常正文在中间）
          if (contentText.length > 5000) {
            const start = Math.floor(contentText.length * 0.2);
            const end = Math.floor(contentText.length * 0.8);
            contentText = contentText.substring(start, end).trim();
          }
        }
      }

      // 步骤4：清理和格式化正文内容
      // 优化：改进内容清理逻辑，提升可读性
      if (contentText && contentText !== '无法获取笔记正文') {
        contentText = contentText
          // 清理多余空白字符
          .replace(/[\r\n]+/g, '\n') // 保留换行符（如果有段落分隔）
          .replace(/[ \t]+/g, ' ') // 多个空格/制表符合并为单个空格
          .replace(/\n\s*\n\s*\n/g, '\n\n') // 多个连续换行合并为两个
          // 清理特殊字符（保留常用标点）
          .replace(/[\u200B-\u200D\uFEFF]/g, '') // 移除零宽字符
          .trim();
        
        // 验证内容质量
        if (contentText.length < 10) {
          console.warn('[小红书解析] 提取的正文过短，可能不准确');
          contentText = '无法获取笔记正文';
        } else {
          console.log(`[小红书解析] 正文清理完成，最终长度: ${contentText.length}字符`);
        }
      }

      // 步骤5：提取地点（如果从初始数据中未获取到）
      // 优化：增强地点提取能力
      if (places.length === 0) {
        console.log('[小红书解析] 从文本中提取地点信息...');
        
        // 扩展地点关键词（包含更多城市和景点）
        const cityPattern = /(北京|上海|广州|深圳|杭州|成都|西安|南京|武汉|重庆|天津|苏州|长沙|郑州|青岛|沈阳|大连|厦门|福州|哈尔滨|济南|石家庄|长春|昆明|合肥|南宁|太原|贵阳|呼和浩特|乌鲁木齐|拉萨|银川|西宁|海口|三亚|丽江|大理|桂林|张家界|黄山|九寨沟|峨眉山|泰山|华山|庐山|武夷山|普陀山|五台山|武当山|青城山|长白山|天山|昆仑山|喜马拉雅|珠穆朗玛|布达拉宫|故宫|天安门|长城|兵马俑|西湖|阳朔|西双版纳|香格里拉|稻城亚丁|泸沽湖|洱海|滇池|青海湖|纳木错|茶卡盐湖|莫高窟|龙门石窟|云冈石窟|大足石刻|乐山大佛|都江堰|乌镇|周庄|同里|西塘|宏村|婺源|凤凰古城|平遥古城|丽江古城|大理古城|鼓浪屿|天涯海角|亚龙湾|蜈支洲岛|涠洲岛|长岛|崇明岛|舟山|千岛湖|天池|镜泊湖|松花江|长江|黄河|珠江|淮河|太湖|鄱阳湖|洞庭湖|洪泽湖|巢湖|滇池|洱海|青海湖|纳木错|羊卓雍错|玛旁雍错|色林错|班公错|茶卡盐湖|察尔汗盐湖|罗布泊|塔克拉玛干|腾格里|巴丹吉林|库布齐|毛乌素|呼伦贝尔|锡林郭勒|科尔沁|鄂尔多斯|阿拉善|那拉提|巴音布鲁克|喀纳斯|禾木|白哈巴|可可托海|天山天池|赛里木湖|喀拉峻|那拉提|巴音布鲁克|昭苏|特克斯|伊犁|吐鲁番|哈密|库尔勒|阿克苏|喀什|和田|阿勒泰|塔城|博尔塔拉|克孜勒苏|昌吉|石河子|五家渠|图木舒克|阿拉尔|铁门关|可克达拉|双河|昆玉|胡杨河|新星|白杨|北屯|可克达拉|双河|昆玉|胡杨河|新星|白杨|北屯)/g;
        
        // 从HTML中提取
        const htmlMatches = html.match(cityPattern);
        if (htmlMatches) {
          places.push(...htmlMatches);
          console.log(`[小红书解析] 从HTML中提取到${htmlMatches.length}个地点`);
        }
        
        // 从正文中提取
        if (places.length === 0 && contentText && contentText !== '无法获取笔记正文') {
          const contentMatches = contentText.match(cityPattern);
          if (contentMatches) {
            places.push(...contentMatches);
            console.log(`[小红书解析] 从正文中提取到${contentMatches.length}个地点`);
          }
        }
      }

      // 去重并限制数量
      const uniquePlaces = [...new Set(places)].slice(0, 10);
      if (uniquePlaces.length > 0) {
        console.log(`[小红书解析] 最终提取地点: ${uniquePlaces.join(', ')}`);
      }

      // 步骤6：使用大模型提取标签（从正文中提取景点/地点标签）
      let tags = [];
      if (contentText && contentText !== '无法获取笔记正文' && contentText !== '未获取到笔记内容') {
        try {
          console.log('[小红书解析] 开始使用大模型提取标签...');
          tags = await extractTagsByGPT(contentText);
          console.log(`[小红书解析] 大模型提取到标签: ${tags.join(', ')}`);
        } catch (tagError) {
          console.error('[小红书解析] 大模型标签提取失败:', tagError.message);
          // 如果大模型提取失败，使用原有的地点列表作为标签
          tags = uniquePlaces;
        }
      } else {
        // 如果没有正文，使用原有的地点列表作为标签
        tags = uniquePlaces;
      }

      // 优化：提升错误处理，提供更详细的日志和错误提示
      const result = {
        title: title || '未获取到标题',
        content: contentText || '未获取到笔记内容',
        places: uniquePlaces,
        tags: tags // 新增：大模型提取的标签
      };
      
      // 验证解析结果质量
      const hasValidContent = result.content && result.content !== '未获取到笔记内容' && result.content !== '无法获取笔记正文';
      const hasValidTitle = result.title && result.title !== '未获取到标题';
      
      if (!hasValidContent && !hasValidTitle) {
        console.error('[小红书解析] 解析失败：未能提取到有效内容');
        res.json({
          code: 1,
          data: null,
          msg: '解析失败：无法从小红书链接中提取内容。可能原因：1) 链接需要登录访问；2) 页面结构已更新；3) 存在反爬虫机制。请尝试手动输入标题和地点信息。'
        });
        return;
      }
      
      if (!hasValidContent) {
        console.warn('[小红书解析] 警告：未能提取到正文内容，仅提取到标题');
      }
      
      console.log(`[小红书解析] 解析完成 - 标题: ${result.title.substring(0, 30)}..., 正文: ${hasValidContent ? '已提取' : '未提取'}, 地点数: ${uniquePlaces.length}`);
      
      res.json({
        code: 0,
        data: result,
        msg: hasValidContent ? '解析成功' : '解析部分成功（已提取标题，但正文提取失败，请手动补充）'
      });
    } catch (parseError) {
      // 优化：提供更具体的错误提示
      console.error('[小红书解析] 解析过程出错:', parseError);
      console.error('[小红书解析] 错误堆栈:', parseError.stack);
      
      let errorMsg = '解析失败：';
      if (parseError.message.includes('timeout')) {
        errorMsg += '请求超时，请检查网络连接或稍后重试。';
      } else if (parseError.message.includes('ECONNREFUSED')) {
        errorMsg += '无法连接到小红书服务器，请检查网络连接。';
      } else if (parseError.message.includes('404')) {
        errorMsg += '链接不存在或已失效，请检查链接是否正确。';
      } else if (parseError.message.includes('403') || parseError.message.includes('401')) {
        errorMsg += '访问被拒绝，链接可能需要登录或存在反爬虫机制。';
      } else {
        errorMsg += parseError.message || '未知错误，请手动输入标题和地点信息。';
      }
      
      res.json({
        code: 1,
        data: null,
        msg: errorMsg
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
    const { url, title, content, places, tags } = req.body;
    const userId = getUserId(req); // 支持userId和guestId

    if (!userId || !url) {
      return res.json({
        code: 1,
        data: null,
        msg: '用户ID和链接不能为空'
      });
    }

    // 如果是游客ID，创建或获取游客用户
    if (userId.startsWith('guest_')) {
      await getOrCreateGuestUser(userId);
    }

    const collectionId = crypto.randomBytes(8).toString('hex');
    // 优先使用tags，如果没有则使用places
    const finalTags = Array.isArray(tags) && tags.length > 0 ? tags : (Array.isArray(places) ? places : []);
    const collection = {
      collectionId,
      userId,
      url,
      title: title || '未命名收藏',
      content: content || '',
      places: Array.isArray(places) ? places : [],
      tags: finalTags, // 新增：大模型提取的标签
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
    const userId = getUserId(req); // 支持userId和guestId

    if (!userId) {
      return res.json({
        code: 1,
        data: null,
        msg: '用户ID不能为空'
      });
    }

    // 如果是游客ID，创建或获取游客用户
    if (userId.startsWith('guest_')) {
      await getOrCreateGuestUser(userId);
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

/**
 * 添加标签
 * POST /api/collection/:id/tags
 * Body: { tag }
 */
router.post('/:id/tags', async (req, res) => {
  try {
    const { id } = req.params;
    const { tag } = req.body;

    if (!tag || typeof tag !== 'string' || tag.trim().length === 0) {
      return res.json({
        code: 1,
        data: null,
        msg: '标签不能为空'
      });
    }

    const trimmedTag = tag.trim();

    // 验证标签长度
    if (trimmedTag.length > 20) {
      return res.json({
        code: 1,
        data: null,
        msg: '标签长度不能超过20个字符'
      });
    }

    // 读取收藏列表
    const collections = await readJsonFile('collections.json');
    const collection = collections.find(c => c.collectionId === id);

    if (!collection) {
      return res.json({
        code: 1,
        data: null,
        msg: '收藏项不存在'
      });
    }

    // 获取当前标签列表（优先使用tags，如果没有则使用places）
    const currentTags = Array.isArray(collection.tags) && collection.tags.length > 0
      ? collection.tags
      : (Array.isArray(collection.places) ? collection.places : []);

    // 检查是否重复
    if (currentTags.includes(trimmedTag)) {
      return res.json({
        code: 1,
        data: null,
        msg: '该标签已存在'
      });
    }

    // 添加标签
    const updatedTags = [...currentTags, trimmedTag];

    // 更新收藏项
    const updateSuccess = await updateJsonArrayItem(
      'collections.json',
      'collectionId',
      id,
      { tags: updatedTags }
    );

    if (!updateSuccess) {
      return res.json({
        code: 1,
        data: null,
        msg: '更新失败'
      });
    }

    res.json({
      code: 0,
      data: {
        tags: updatedTags
      },
      msg: '标签添加成功'
    });
  } catch (error) {
    console.error('添加标签错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '添加标签失败'
    });
  }
});

/**
 * 删除标签
 * DELETE /api/collection/:id/tags
 * Body: { tag }
 */
router.delete('/:id/tags', async (req, res) => {
  try {
    const { id } = req.params;
    const { tag } = req.body;

    if (!tag || typeof tag !== 'string' || tag.trim().length === 0) {
      return res.json({
        code: 1,
        data: null,
        msg: '标签不能为空'
      });
    }

    const trimmedTag = tag.trim();

    // 读取收藏列表
    const collections = await readJsonFile('collections.json');
    const collection = collections.find(c => c.collectionId === id);

    if (!collection) {
      return res.json({
        code: 1,
        data: null,
        msg: '收藏项不存在'
      });
    }

    // 获取当前标签列表（优先使用tags，如果没有则使用places）
    const currentTags = Array.isArray(collection.tags) && collection.tags.length > 0
      ? collection.tags
      : (Array.isArray(collection.places) ? collection.places : []);

    // 检查标签是否存在
    if (!currentTags.includes(trimmedTag)) {
      return res.json({
        code: 1,
        data: null,
        msg: '标签不存在'
      });
    }

    // 删除标签
    const updatedTags = currentTags.filter(t => t !== trimmedTag);

    // 更新收藏项
    const updateSuccess = await updateJsonArrayItem(
      'collections.json',
      'collectionId',
      id,
      { tags: updatedTags }
    );

    if (!updateSuccess) {
      return res.json({
        code: 1,
        data: null,
        msg: '更新失败'
      });
    }

    res.json({
      code: 0,
      data: {
        tags: updatedTags
      },
      msg: '标签删除成功'
    });
  } catch (error) {
    console.error('删除标签错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '删除标签失败'
    });
  }
});

module.exports = router;


