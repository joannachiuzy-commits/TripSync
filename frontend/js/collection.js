/**
 * 收藏夹模块
 * 处理小红书链接解析、收藏保存、收藏列表展示
 */

let currentParseData = null;

/**
 * 解析小红书链接
 */
async function parseXiaohongshuUrl() {
  const url = document.getElementById('xiaohongshuUrl').value.trim();

  if (!url) {
    window.api.showToast('请输入小红书链接', 'error');
    return;
  }

  try {
    const data = await window.api.post('/collection/parse', { url });
    
    // 保存解析结果
    currentParseData = {
      url,
      title: data.title || '未获取到标题',
      content: data.content || '',
      places: data.places || []
    };

    // 显示解析结果
    document.getElementById('parseTitle').textContent = currentParseData.title;
    document.getElementById('parseContent').textContent = 
      currentParseData.content || '未获取到内容';
    
    // 显示地点标签
    const placesContainer = document.getElementById('parsePlaces');
    if (currentParseData.places.length > 0) {
      placesContainer.innerHTML = currentParseData.places
        .map(place => `<span class="place-tag">${place}</span>`)
        .join('');
    } else {
      placesContainer.innerHTML = '<span class="empty-tip">未提取到地点</span>';
    }

    document.getElementById('parseResult').style.display = 'block';
  } catch (error) {
    // 错误已在 api.js 中处理
    // 如果是解析失败，允许用户手动输入
    if (error.message.includes('解析失败')) {
      currentParseData = {
        url,
        title: '',
        content: '',
        places: []
      };
      document.getElementById('parseTitle').textContent = '';
      document.getElementById('parseContent').textContent = '';
      document.getElementById('parsePlaces').innerHTML = '<span class="empty-tip">请手动输入标题和地点</span>';
      document.getElementById('parseResult').style.display = 'block';
    }
  }
}

/**
 * 保存收藏
 * 【游客权限逻辑】游客模式下需要登录才能保存收藏
 */
async function saveCollection() {
  if (!currentParseData) {
    window.api.showToast('请先解析链接', 'error');
    return;
  }

  // 【游客权限逻辑】检查是否为游客模式，游客无法保存收藏
  if (!window.userModule.isLoggedIn()) {
    window.userModule.showLoginGuideModal();
    return; // 阻止后续操作
  }

  const user = window.userModule.getCurrentUser();
  if (!user) {
    window.api.showToast('请先登录', 'error');
    return;
  }

  // 如果标题为空，允许用户输入
  let title = currentParseData.title;
  if (!title) {
    title = prompt('请输入标题：');
    if (!title) {
      window.api.showToast('标题不能为空', 'error');
      return;
    }
  }

  try {
    await window.api.post('/collection/save', {
      userId: user.userId,
      url: currentParseData.url,
      title,
      content: currentParseData.content,
      places: currentParseData.places
    });

    window.api.showToast('收藏成功', 'success');
    
    // 清空输入和结果
    document.getElementById('xiaohongshuUrl').value = '';
    document.getElementById('parseResult').style.display = 'none';
    currentParseData = null;

    // 刷新收藏列表
    loadCollections();
  } catch (error) {
    // 错误已在 api.js 中处理
  }
}

/**
 * 加载收藏列表
 */
async function loadCollections() {
  const user = window.userModule.getCurrentUser();
  if (!user) {
    return;
  }

  try {
    const data = await window.api.get('/collection/list', { userId: user.userId });
    const collections = data.collections || [];

    const container = document.getElementById('collectionsList');
    
    if (collections.length === 0) {
      container.innerHTML = '<p class="empty-tip">暂无收藏，请先解析并收藏小红书链接</p>';
      return;
    }

    container.innerHTML = collections.map(collection => `
      <div class="collection-item" data-collection-id="${collection.collectionId}">
        <div class="collection-title">${collection.title}</div>
        <div class="collection-url">${collection.url}</div>
        ${collection.places && collection.places.length > 0 ? `
          <div class="collection-places">
            ${collection.places.map(place => `<span class="place-tag">${place}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `).join('');

    // 更新生成行程页面的收藏复选框
    updateCollectionCheckboxes(collections);
  } catch (error) {
    // 错误已在 api.js 中处理
  }
}

/**
 * 更新生成行程页面的收藏复选框
 */
function updateCollectionCheckboxes(collections) {
  const container = document.getElementById('collectionCheckboxes');
  
  if (collections.length === 0) {
    container.innerHTML = '<p class="empty-tip">暂无收藏，请先到收藏夹添加</p>';
    return;
  }

  container.innerHTML = collections.map(collection => `
    <div class="checkbox-item">
      <label>
        <input type="checkbox" value="${collection.collectionId}" data-collection='${JSON.stringify(collection)}'>
        <div>
          <div style="font-weight: 600;">${collection.title}</div>
          ${collection.places && collection.places.length > 0 ? `
            <div class="collection-places" style="margin-top: 0.25rem;">
              ${collection.places.slice(0, 5).map(place => `<span class="place-tag">${place}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      </label>
    </div>
  `).join('');
}

/**
 * 获取选中的收藏
 */
function getSelectedCollections() {
  const checkboxes = document.querySelectorAll('#collectionCheckboxes input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => JSON.parse(cb.dataset.collection));
}

/**
 * 处理小红书链接粘贴事件
 * 自动提取以https://www.xiaohongshu.com开头的URL，清除前面的多余内容
 */
function handleXiaohongshuUrlPaste(e) {
  // 阻止默认粘贴行为，手动处理内容
  e.preventDefault();
  
  // 获取粘贴板中的内容
  const pasteContent = (e.clipboardData || window.clipboardData).getData('text');
  if (!pasteContent) return;
  
  const xhsLinkInput = document.getElementById('xiaohongshuUrl');
  if (!xhsLinkInput) return;
  
  // 正则匹配小红书链接（匹配以https://www.xiaohongshu.com开头的完整URL）
  // 匹配规则：
  // 1. https://www.xiaohongshu.com 或 https://xiaohongshu.com
  // 2. 后面跟路径部分（非空白字符），直到遇到空白字符、换行符、中文字符或字符串结束
  // 3. 支持匹配到问号?、井号#等URL参数和锚点
  const xhsLinkRegex = /https?:\/\/(www\.)?xiaohongshu\.com[^\s\u4e00-\u9fa5\n\r]+/;
  const matchResult = pasteContent.match(xhsLinkRegex);
  
  if (matchResult && matchResult[0]) {
    // 提取到有效链接，设置到输入框
    const extractedUrl = matchResult[0].trim();
    xhsLinkInput.value = extractedUrl;
    
    // 显示成功提示（使用较短的提示时间，避免干扰用户）
    if (window.api && window.api.showToast) {
      window.api.showToast('已自动提取链接', 'success');
    }
    
    console.log('已自动提取小红书链接:', extractedUrl);
  } else {
    // 未匹配到有效链接，允许粘贴原始内容（用户可能手动输入或复制了其他内容）
    xhsLinkInput.value = pasteContent;
    
    // 静默处理，不显示错误提示（避免干扰用户手动输入）
    console.log('未检测到小红书链接格式，保留原始粘贴内容');
  }
}

/**
 * 初始化收藏夹模块
 */
function initCollection() {
  // 解析按钮
  document.getElementById('parseBtn').addEventListener('click', parseXiaohongshuUrl);

  // 保存收藏按钮
  document.getElementById('saveCollectionBtn').addEventListener('click', saveCollection);

  // 小红书链接输入框的粘贴事件处理
  const xhsLinkInput = document.getElementById('xiaohongshuUrl');
  if (xhsLinkInput) {
    xhsLinkInput.addEventListener('paste', handleXiaohongshuUrlPaste);
  }

  // 回车键解析
  xhsLinkInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      parseXiaohongshuUrl();
    }
  });

  // 加载收藏列表
  loadCollections();
}

// 导出收藏相关函数
window.collectionModule = {
  loadCollections,
  getSelectedCollections,
  initCollection
};

