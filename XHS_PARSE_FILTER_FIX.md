# 小红书解析过滤规则修复文档

## 修复时间
2025-12-09

## 问题描述

当前小红书解析时误过滤了笔记正文，显示"暂无法提取有效内容"。原因是过滤规则过于严格，将正常的笔记正文也过滤掉了。

## 修复内容

### 一、调整内容过滤规则（server.js）

#### 1. 优化`hasUnrelatedContent`函数

**位置：** `backend/server.js` 第305-362行

**修复前：**
```javascript
const unrelatedKeywords = [
  '推荐',      // ❌ 太宽泛，会误过滤正文中的"推荐"
  '相关',      // ❌ 太宽泛，会误过滤正文中的"相关"
  '更多',      // ❌ 太宽泛，会误过滤正文中的"更多"
  // ...
]

// 如果匹配多个无关模式，可能是评论/推荐区域
if (patternMatches.length >= 2) {
  return true  // ❌ 过于严格，会误过滤正文
}
```

**修复后：**
```javascript
/**
 * 【优化9-修复】检测内容是否包含评论/推荐等无关信息（只检测明确的标识，不误过滤正文）
 */
const hasUnrelatedContent = (content) => {
  // 【修复1】只检测明确的评论/推荐标识，不再笼统过滤
  
  // 明确的无关关键词（必须是完整的短语，避免误判）
  const explicitUnrelatedKeywords = [
    '登录后推荐',        // ✅ 明确的登录提示
    '登录查看更多',      // ✅ 明确的登录提示
    '相关推荐',          // ✅ 明确的推荐标识
    '热门评论',          // ✅ 明确的评论标识
    '推荐笔记',          // ✅ 明确的推荐标识
    '你可能还喜欢',      // ✅ 明确的推荐标识
    '猜你喜欢',          // ✅ 明确的推荐标识
    '大家都在搜',        // ✅ 明确的搜索标识
    '热门话题',          // ✅ 明确的话题标识
    '查看更多',          // ✅ 明确的查看更多标识
    '朱元璋告御状',      // ✅ 明确的无关内容
    '水银体温计将禁产'  // ✅ 明确的无关内容
  ]
  
  // 【修复2】检测明确的评论/推荐标识（如"11-30"、"942.8w"），但只在独立行
  // 如果内容很短（少于30字符），且匹配评论数格式（如"11-30"），可能是评论数
  if (content.length < 30 && /^\d+-\d+$/.test(content.trim())) {
    return true
  }
  
  // 如果内容很短（少于30字符），且匹配浏览量格式（如"942.8w"），可能是浏览量
  if (content.length < 30 && /^\d+\.\d+[wk]$/.test(content.trim())) {
    return true
  }
  
  // 检查是否匹配明确的无关模式（行尾匹配，避免误判正文中的词汇）
  const patternMatches = explicitUnrelatedPatterns.filter(pattern => pattern.test(content))
  if (patternMatches.length > 0) {
    return true
  }
  
  return false
}
```

**关键修改点：**
- ✅ 移除过于宽泛的关键词（"推荐"、"相关"、"更多"等）
- ✅ 只保留明确的无关关键词（完整短语）
- ✅ 评论数/浏览量检测只在独立行且长度很短时触发
- ✅ 使用行尾匹配（`$`），避免误判正文中的词汇

---

#### 2. 优化`filterUnrelatedContent`函数

**位置：** `backend/server.js` 第369-401行

**修复前：**
```javascript
// 跳过包含评论数、点赞数等的行
if (/\d+-\d+/.test(trimmedLine) && trimmedLine.length < 20) {
  continue  // ❌ 会误过滤正文中的"11-30号"等
}

// 跳过包含"w"、"k"等浏览量的行
if (/\d+\.\d+[wk]/.test(trimmedLine) && trimmedLine.length < 30) {
  continue  // ❌ 会误过滤正文中的其他数字
}
```

**修复后：**
```javascript
/**
 * 【优化10-修复】过滤内容中的评论/推荐等无关信息（只过滤明确的标识，保留正文）
 */
const filterUnrelatedContent = (content) => {
  // 【修复4】只跳过明确的评论/推荐行（使用修复后的检测函数）
  if (hasUnrelatedContent(trimmedLine)) {
    continue
  }
  
  // 【修复5】只跳过明确的评论数格式（独立行，且长度很短）
  // 如"11-30"这样的独立行才过滤，不过滤正文中的"11-30号"等
  if (/^\d+-\d+$/.test(trimmedLine) && trimmedLine.length < 20) {
    continue
  }
  
  // 【修复6】只跳过明确的浏览量格式（独立行，且长度很短）
  // 如"942.8w"这样的独立行才过滤，不过滤正文中的其他数字
  if (/^\d+\.\d+[wk]$/.test(trimmedLine) && trimmedLine.length < 30) {
    continue
  }
  
  // 保留所有其他内容（包括包含特殊符号的正文）
  filteredLines.push(trimmedLine)
}
```

**关键修改点：**
- ✅ 使用`^`和`$`确保是独立行
- ✅ 只过滤明确的评论数/浏览量格式
- ✅ 保留包含特殊符号的正文（如"！！！"）

---

#### 3. 优化内容验证逻辑

**位置：** `backend/server.js` 第710-727行

**修复前：**
```javascript
// 如果过滤后内容仍然包含无关信息或为空，返回提示
if (!filteredRawContent || filteredRawContent.length < 10 || hasUnrelatedContent(filteredRawContent)) {
  filteredRawContent = '暂无法提取有效内容'  // ❌ 过于严格，会误过滤正文
}
```

**修复后：**
```javascript
// 【优化14-修复】验证内容是否包含无关信息（只过滤明确的标识，保留正文）
// 如果过滤后内容为空或太短，使用原始内容（避免误过滤）
if (!filteredRawContent || filteredRawContent.length < 10) {
  console.warn('⚠️ 过滤后内容为空，使用原始内容')
  filteredRawContent = pageData.rawContent || pageData.description || ''
}

// 【修复7】只移除明确的无关行，保留正文内容
if (filteredRawContent && filteredRawContent.length > 10) {
  const lines = filteredRawContent.split(/\n/)
  const cleanLines = lines.filter(line => {
    const trimmedLine = line.trim()
    // 保留空行和有效内容
    if (!trimmedLine || trimmedLine.length < 3) return true
    // 只过滤明确的无关行
    return !hasUnrelatedContent(trimmedLine)
  })
  filteredRawContent = cleanLines.join('\n').trim()
}

// 【修复8】只有在内容完全为空时才返回提示，不再因为包含无关信息就返回提示
if (!filteredRawContent || filteredRawContent.length < 5) {
  console.warn('⚠️ 无法提取有效内容')
  filteredRawContent = '暂无法提取有效内容'
}
```

**关键修改点：**
- ✅ 过滤后内容为空时，使用原始内容（避免误过滤）
- ✅ 只移除明确的无关行，保留正文内容
- ✅ 只有在内容完全为空时才返回提示

---

#### 4. 优化最终验证逻辑

**位置：** `backend/server.js` 第900-910行

**修复前：**
```javascript
// 【优化18】最终验证：检查返回结果是否包含无关信息
if (hasUnrelatedContent(result.raw.content) && result.raw.content !== '暂无法提取有效内容') {
  result.raw.content = '暂无法提取有效内容'  // ❌ 过于严格，会误过滤正文
}
```

**修复后：**
```javascript
// 【优化18-修复】最终验证：只在内容完全为空时才返回提示，不再误过滤正文
// 如果内容存在且长度足够，即使包含一些无关信息也保留（避免误过滤正文）
if (!result.raw.content || result.raw.content.length < 5) {
  console.warn('⚠️ 最终验证：内容为空，返回提示')
  result.raw.content = '暂无法提取有效内容'
} else if (result.raw.content === '暂无法提取有效内容') {
  // 已经是提示信息，保持不变
} else {
  // 内容存在，保留（不再因为包含无关信息就过滤掉）
  console.log('✅ 最终验证：内容有效，保留正文')
}
```

**关键修改点：**
- ✅ 只在内容完全为空时才返回提示
- ✅ 内容存在时保留，不再误过滤正文

---

### 二、图片提取优化（server.js）

#### 优化图片选择器

**位置：** `backend/server.js` 第736-763行

**修复前：**
```javascript
// 方法2: 从所有 img 标签提取
const imgElements = document.querySelectorAll('img')
```

**修复后：**
```javascript
// 【优化19】提取图片链接（优化选择器，适配最新类名）
// 【优化19-1】方法2: 从笔记图片区域提取（适配最新类名）
const noteImageSelectors = [
  '.note-image',              // 小红书笔记图片类名
  '[class*="note-image"]',   // 包含note-image的类名
  '[class*="noteImage"]',    // 驼峰命名
  '[class*="image"]',        // 包含image的类名
  'img[class*="note"]',      // 笔记相关的img标签
]

for (const selector of noteImageSelectors) {
  const imgElements = document.querySelectorAll(selector)
  // 提取图片URL
}

// 【优化19-2】方法3: 从所有 img 标签提取（兜底方案）
const allImgElements = document.querySelectorAll('img')
```

**关键修改点：**
- ✅ 新增多个笔记图片选择器（`.note-image`、`[class*="note-image"]`等）
- ✅ 优先从笔记图片区域提取
- ✅ 使用兜底方案确保能提取到图片

---

### 三、地址提取增强（server.js）

#### 新增地名关键词匹配

**位置：** `backend/server.js` 第800-850行

**新增代码：**
```javascript
// 【优化20】地址提取增强：若地址"暂无法提取"，尝试从标题/正文中匹配地名关键词
if (!address || address === '暂无法提取') {
  // 常见地名关键词（城市、地区、景点等）
  const locationKeywords = [
    '北京', '上海', '广州', '深圳', '杭州', '成都', '重庆', '西安', '南京', '武汉',
    '大理', '丽江', '三亚', '桂林', '张家界', '九寨沟', '黄山', '庐山', '泰山', '华山',
    '日本', '东京', '大阪', '京都', '北海道', '冲绳', '镰仓', '奈良', '箱根',
    '韩国', '首尔', '釜山', '济州岛',
    '泰国', '曼谷', '清迈', '普吉岛', '芭提雅',
    // ... 更多地名
  ]
  
  // 从标题和正文中查找地名
  const searchText = `${pageData.title || ''} ${filteredTextContent || ''} ${pageData.description || ''}`
  
  for (const keyword of locationKeywords) {
    // 使用单词边界匹配，避免误匹配
    const regex = new RegExp(`[^\\w]${keyword}[^\\w]|^${keyword}[^\\w]|[^\\w]${keyword}$|^${keyword}$`, 'i')
    if (regex.test(searchText)) {
      address = keyword
      console.log(`✅ 从标题/正文中匹配到地名: ${keyword}`)
      break
    }
  }
  
  // 如果还没找到，尝试匹配常见的地址格式（如"📍 大理"）
  if (!address || address === '暂无法提取') {
    const locationMatch = searchText.match(/📍\s*([^\s\n，,。.]+)/i)
    if (locationMatch && locationMatch[1]) {
      address = locationMatch[1].trim()
      console.log(`✅ 从📍标记中提取到地址: ${address}`)
    }
  }
}
```

**关键修改点：**
- ✅ 新增地名关键词列表（城市、地区、景点等）
- ✅ 从标题/正文中匹配地名关键词
- ✅ 使用单词边界匹配，避免误匹配
- ✅ 支持从📍标记中提取地址

---

## 四、修改文件清单

### 后端文件（1个）
1. **backend/server.js**
   - 优化`hasUnrelatedContent`函数（第305-362行）
   - 优化`filterUnrelatedContent`函数（第369-401行）
   - 优化内容验证逻辑（第710-727行）
   - 优化图片提取选择器（第736-763行）
   - 新增地址提取增强（第800-850行）
   - 优化最终验证逻辑（第900-910行）

---

## 五、测试用的公开笔记链接

### 推荐测试链接（公开笔记）

1. **美食类：**
   - `https://www.xiaohongshu.com/explore/65f96b6f000000001300b2a4`
   - `https://www.xiaohongshu.com/explore/63f7fb9a0000000013001d1a`

2. **旅游类：**
   - `https://www.xiaohongshu.com/discovery/item/6810cb99000000002100e91c`

**测试验证：**
- ✅ 解析结果正常显示笔记标题、正文
- ✅ 解析结果不包含"暂无法提取有效内容"（除非真的无法提取）
- ✅ 解析结果包含图片（如果笔记有图片）
- ✅ 解析结果包含地址（从标题/正文中匹配地名）
- ✅ 评论/无关内容被过滤，正文不丢失

---

## 六、代码检查

### ✅ 过滤规则检查

1. **关键词列表：** ✅ 只保留明确的无关关键词（完整短语）
2. **模式匹配：** ✅ 使用行尾匹配（`$`），避免误判正文
3. **独立行检测：** ✅ 使用`^`和`$`确保是独立行
4. **内容保留：** ✅ 保留包含特殊符号的正文（如"！！！"）

### ✅ 图片提取检查

1. **选择器：** ✅ 新增多个笔记图片选择器（`.note-image`等）
2. **优先级：** ✅ 优先从笔记图片区域提取
3. **兜底方案：** ✅ 使用所有img标签作为兜底

### ✅ 地址提取检查

1. **地名匹配：** ✅ 从标题/正文中匹配地名关键词
2. **📍标记：** ✅ 支持从📍标记中提取地址
3. **单词边界：** ✅ 使用单词边界匹配，避免误匹配

### ✅ 验证逻辑检查

1. **内容保留：** ✅ 只在内容完全为空时才返回提示
2. **正文不丢失：** ✅ 确保正文内容不被误过滤

---

## 七、修复总结

### ✅ 已完成的修复

1. **过滤规则优化：** ✅ 只过滤明确的评论/推荐标识，不再笼统过滤
2. **正文保留：** ✅ 确保笔记正文不被误过滤
3. **图片提取优化：** ✅ 调整选择器适配最新类名
4. **地址提取增强：** ✅ 从标题/正文中匹配地名关键词

### 🎯 预期效果

1. **正文正常显示：** 不再误过滤笔记正文
2. **图片正常提取：** 适配最新类名，提取笔记图片
3. **地址智能匹配：** 从标题/正文中匹配地名关键词
4. **无关内容过滤：** 只过滤明确的评论/推荐标识

---

## 八、注意事项

1. **过滤规则：** 过滤规则已优化，但仍需根据实际情况调整
2. **地名关键词：** 地名关键词列表可能需要根据实际使用情况扩展
3. **选择器适配：** 小红书页面结构可能变化，选择器需要定期更新

---

## 九、后续优化建议

1. **地名库扩展：** 可以考虑使用地名库API，提高地址匹配准确率
2. **机器学习：** 可以考虑使用机器学习模型识别笔记主体内容
3. **用户反馈：** 收集用户反馈，持续优化过滤规则

