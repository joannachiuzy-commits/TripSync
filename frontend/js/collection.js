/**
 * 收藏夹模块
 * 处理小红书链接解析、收藏保存、收藏列表展示
 */

let currentParseData = null;

// 存储解析结果的临时标签（初始值为解析出的地点）
let tempParseTags = [];

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
    // 优先使用大模型提取的tags，如果没有则使用places
    const tags = data.tags || data.places || [];
    currentParseData = {
      url,
      title: data.title || '未获取到标题',
      content: data.content || '',
      places: data.places || [],
      tags: tags, // 新增：大模型提取的标签
      type: data.type || '其他' // 新增：AI识别的内容类型
    };

    // 显示解析结果
    document.getElementById('parseTitle').textContent = currentParseData.title;
    document.getElementById('parseContent').textContent = 
      currentParseData.content || '未获取到内容';
    
    // 显示AI识别的内容类型
    const contentTypeElement = document.getElementById('parseContentType');
    if (contentTypeElement) {
      contentTypeElement.textContent = currentParseData.type || '其他';
    }
    
    // 初始化解析结果的标签（优先使用tags，如果没有则使用places）
    const tagsToShow = currentParseData.tags && currentParseData.tags.length > 0 
      ? currentParseData.tags 
      : currentParseData.places;
    initParseResultTags(tagsToShow);

    document.getElementById('parseResult').style.display = 'block';
  } catch (error) {
    // 错误已在 api.js 中处理
    // 如果是解析失败，允许用户手动输入
    if (error.message.includes('解析失败')) {
      currentParseData = {
        url,
        title: '',
        content: '',
        places: [],
        tags: [],
        type: '其他'
      };
      document.getElementById('parseTitle').textContent = '';
      document.getElementById('parseContent').textContent = '';
      const contentTypeElement = document.getElementById('parseContentType');
      if (contentTypeElement) {
        contentTypeElement.textContent = '其他';
      }
      initParseResultTags([]);
      document.getElementById('parseResult').style.display = 'block';
    }
  }
}

/**
 * 初始化解析结果的标签（页面加载后调用）
 */
function initParseResultTags(initialTags) {
  tempParseTags = [...initialTags];
  const tagsContainer = document.getElementById('parseResultTags');
  if (!tagsContainer) return;
  
  tagsContainer.innerHTML = ''; // 清空原有内容
  
  // 渲染标签项
  if (tempParseTags.length > 0) {
    tempParseTags.forEach(tag => {
      const tagItem = document.createElement('span');
      tagItem.className = 'tag-item';
      // 转义HTML，防止XSS攻击
      tagItem.innerHTML = `${window.utils.escapeHtml(tag)} <button class="tag-delete-btn" data-tag="${window.utils.escapeHtml(tag)}" title="删除标签">×</button>`;
      tagsContainer.appendChild(tagItem);
    });
  } else {
    tagsContainer.innerHTML = '<span class="empty-tip">暂无标签</span>';
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
    // 获取编辑后的临时标签
    const tags = tempParseTags;
    
    await window.api.post('/collection/save', {
      userId: user.userId,
      url: currentParseData.url,
      title,
      content: currentParseData.content,
      places: currentParseData.places,
      tags: tags // 传递编辑后的标签
    });

    window.api.showToast('收藏成功', 'success');
    
    // 清空输入和结果
    document.getElementById('xiaohongshuUrl').value = '';
    document.getElementById('parseResult').style.display = 'none';
    currentParseData = null;
    tempParseTags = []; // 清空临时标签

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

    // 转义HTML特殊字符，防止XSS攻击
    container.innerHTML = collections.map(collection => {
      const title = window.utils.escapeHtml(collection.title || '未命名收藏');
      // URL不需要转义，但需要验证和清理
      const url = (collection.url || '').trim();
      const content = window.utils.escapeHtml(collection.content || '暂无笔记正文');
      // 优先使用tags，如果没有则使用places
      const tagsToShow = (collection.tags && collection.tags.length > 0) 
        ? collection.tags 
        : (collection.places || []);
      const places = tagsToShow.length > 0
        ? tagsToShow.map(tag => `<span class="location-tag">${window.utils.escapeHtml(tag)}</span>`).join('')
        : '';
      
      return `
        <div class="collection-item clickable" data-collection-id="${collection.collectionId}" data-note-id="${collection.collectionId}">
          <!-- 收起状态：仅显示标题+链接 -->
          <div class="collection-header">
            <h4 class="collection-title note-title">${title}</h4>
            <div class="note-actions">
              ${url ? `
                <a href="${url}" target="_blank" class="collection-link" title="打开原笔记" rel="noopener noreferrer">
                  查看原笔记
                </a>
              ` : ''}
              <button class="delete-note-btn" type="button">删除</button>
            </div>
          </div>
          <!-- 展开状态：显示完整详情 -->
          <div class="collection-detail" style="display: none;">
            <p class="collection-content">${content}</p>
            <!-- 标签区域（带删除按钮和添加控件） -->
            <div class="collection-tag-group">
              <div class="collection-tags">
                ${tagsToShow.length > 0 ? tagsToShow.map(tag => `
                  <span class="tag-item">
                    ${window.utils.escapeHtml(tag)}
                    <button class="tag-delete-btn" data-tag="${window.utils.escapeHtml(tag)}" title="删除标签">×</button>
                  </span>
                `).join('') : '<span class="empty-tip">暂无标签</span>'}
              </div>
              <!-- 添加标签的控件 -->
              <div class="tag-add-group">
                <input type="text" class="tag-add-input" placeholder="输入新标签" maxlength="20">
                <button class="tag-add-btn">添加</button>
              </div>
            </div>
            <button class="collapse-btn">收起详情</button>
          </div>
        </div>
      `;
    }).join('');

    // 添加交互逻辑：点击收藏项展开/收起详情
    document.querySelectorAll('.collection-item.clickable').forEach(item => {
      item.addEventListener('click', (e) => {
        // 新增：排除标签相关操作元素（删除按钮、添加按钮、输入框）
        // 避免点击这些元素时触发展开/折叠
        if (e.target.matches(
          '.collection-link, .collapse-btn, .tag-delete-btn, .tag-add-btn, .tag-add-input, .delete-note-btn'
        )) {
          return; // 点击这些元素时，不执行展开/折叠
        }
        
        // 检查是否点击在标签相关元素内部（通过closest检查）
        if (e.target.closest('.tag-item, .tag-add-group, .collection-tag-group, .note-actions')) {
          return; // 点击标签相关区域时，不执行展开/折叠
        }
        
        const detail = item.querySelector('.collection-detail');
        if (detail) {
          detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
        }
      });
    });

    // 添加交互逻辑：点击"收起详情"按钮
    document.querySelectorAll('.collapse-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        const detail = e.target.closest('.collection-detail');
        if (detail) {
          detail.style.display = 'none';
        }
      });
    });

    // 添加标签删除和添加的交互逻辑
    setupTagManagement();

    // 添加收藏笔记删除的交互逻辑
    setupCollectionDelete();

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

  container.innerHTML = collections.map(collection => {
    // 优先使用tags，如果没有则使用places
    const tagsToShow = (collection.tags && collection.tags.length > 0) 
      ? collection.tags 
      : (collection.places || []);
    return `
    <div class="checkbox-item">
      <label>
        <input type="checkbox" value="${collection.collectionId}" data-collection='${JSON.stringify(collection)}'>
        <div>
          <div style="font-weight: 600;">${collection.title}</div>
          ${tagsToShow.length > 0 ? `
            <div class="collection-places" style="margin-top: 0.25rem;">
              ${tagsToShow.slice(0, 5).map(tag => `<span class="place-tag">${tag}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      </label>
    </div>
  `;
  }).join('');
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
 * 设置标签管理功能（删除标签、添加标签）
 */
function setupTagManagement() {
  // 监听标签输入框的focus事件，阻止冒泡（防止输入框聚焦时误触展开/折叠）
  document.addEventListener('focus', (e) => {
    if (e.target.matches('.tag-add-input')) {
      e.stopPropagation();
    }
  }, true); // 注意：这里需要传true启用捕获阶段监听

  // 1. 监听"删除标签"按钮点击
  document.addEventListener('click', async (e) => {
    if (e.target.matches('.tag-delete-btn')) {
      e.stopPropagation(); // 阻止事件冒泡，避免触发展开/收起
      
      const deleteBtn = e.target;
      const tag = deleteBtn.dataset.tag;
      const tagItem = deleteBtn.closest('.tag-item');
      const collectionItem = tagItem.closest('.collection-item');
      const collectionId = collectionItem.dataset.collectionId;

      if (!collectionId) {
        window.api.showToast('无法获取收藏项ID', 'error');
        return;
      }

      // 1. 前端先移除标签
      const originalDisplay = tagItem.style.display;
      tagItem.style.display = 'none';

      // 2. 调用后端API同步删除
      try {
        const responseData = await window.api.fetchRaw(`/collection/${collectionId}/tags`, {
          method: 'DELETE',
          body: { tag }
        });
        
        if (responseData.code === 0) {
          // 删除成功，移除DOM元素
          tagItem.remove();
          
          // 如果标签列表为空，显示提示
          const tagsContainer = collectionItem.querySelector('.collection-tags');
          if (tagsContainer && tagsContainer.querySelectorAll('.tag-item').length === 0) {
            tagsContainer.innerHTML = '<span class="empty-tip">暂无标签</span>';
          }
          
          window.api.showToast('标签删除成功', 'success');
        } else {
          // 删除失败，恢复显示
          tagItem.style.display = originalDisplay || '';
          window.api.showToast(responseData.msg || '标签删除失败', 'error');
        }
      } catch (error) {
        // 删除失败，恢复显示
        tagItem.style.display = originalDisplay || '';
        window.api.showToast('标签删除失败，请重试', 'error');
      }
    }
  });

  // 2. 监听"添加标签"按钮点击
  document.addEventListener('click', async (e) => {
    if (e.target.matches('.tag-add-btn')) {
      e.stopPropagation(); // 阻止事件冒泡
      
      const addBtn = e.target;
      const input = addBtn.previousElementSibling;
      const newTag = input.value.trim();
      const collectionItem = addBtn.closest('.collection-item');
      const collectionId = collectionItem.dataset.collectionId;
      const tagsContainer = collectionItem.querySelector('.collection-tags');

      if (!collectionId) {
        window.api.showToast('无法获取收藏项ID', 'error');
        return;
      }

      // 验证：标签非空
      if (!newTag) {
        window.api.showToast('请输入标签内容', 'error');
        return;
      }

      // 验证：标签长度
      if (newTag.length > 20) {
        window.api.showToast('标签长度不能超过20个字符', 'error');
        return;
      }

      // 验证：不重复
      const existingTags = Array.from(tagsContainer.querySelectorAll('.tag-item'))
        .map(item => {
          const deleteBtn = item.querySelector('.tag-delete-btn');
          return deleteBtn ? deleteBtn.dataset.tag : item.textContent.trim().replace('×', '').trim();
        })
        .filter(tag => tag && tag !== '暂无标签');
      
      if (existingTags.includes(newTag)) {
        window.api.showToast('该标签已存在', 'error');
        input.value = '';
        return;
      }

      // 1. 前端先添加标签
      // 移除"暂无标签"提示
      const emptyTip = tagsContainer.querySelector('.empty-tip');
      if (emptyTip) {
        emptyTip.remove();
      }

      const newTagItem = document.createElement('span');
      newTagItem.className = 'tag-item';
      newTagItem.innerHTML = `${window.utils.escapeHtml(newTag)} <button class="tag-delete-btn" data-tag="${window.utils.escapeHtml(newTag)}" title="删除标签">×</button>`;
      tagsContainer.appendChild(newTagItem);
      input.value = '';

      // 2. 调用后端API同步添加
      try {
        const responseData = await window.api.fetchRaw(`/collection/${collectionId}/tags`, {
          method: 'POST',
          body: { tag: newTag }
        });
        
        if (responseData.code === 0) {
          window.api.showToast('标签添加成功', 'success');
        } else {
          // 添加失败，回滚
          newTagItem.remove();
          if (tagsContainer.querySelectorAll('.tag-item').length === 0) {
            tagsContainer.innerHTML = '<span class="empty-tip">暂无标签</span>';
          }
          window.api.showToast(responseData.msg || '标签添加失败', 'error');
        }
      } catch (error) {
        // 添加失败，回滚
        newTagItem.remove();
        if (tagsContainer.querySelectorAll('.tag-item').length === 0) {
          tagsContainer.innerHTML = '<span class="empty-tip">暂无标签</span>';
        }
        window.api.showToast('标签添加失败，请重试', 'error');
      }
    }
  });

  // 3. 监听标签输入框的回车键
  document.addEventListener('keypress', (e) => {
    if (e.target.matches('.tag-add-input') && e.key === 'Enter') {
      e.preventDefault();
      const addBtn = e.target.nextElementSibling;
      if (addBtn && addBtn.matches('.tag-add-btn')) {
        addBtn.click();
      }
    }
  });
}

/**
 * 设置收藏笔记删除功能
 */
function setupCollectionDelete() {
  // 监听所有删除按钮的点击事件
  document.addEventListener('click', async (e) => {
    // 仅匹配收藏笔记的删除按钮
    if (e.target.matches('.delete-note-btn')) {
      e.stopPropagation(); // 阻止事件冒泡，避免触发展开/折叠
      
      const deleteBtn = e.target;
      const noteItem = deleteBtn.closest('.collection-item');
      const noteId = noteItem.dataset.noteId; // 获取笔记ID
      const noteTitleElement = noteItem.querySelector('.note-title');
      const noteTitle = noteTitleElement ? noteTitleElement.textContent : '该笔记';

      if (!noteId) {
        window.api.showToast('无法获取笔记ID', 'error');
        return;
      }

      // 步骤1：弹出确认弹窗（防止误删）
      const isConfirm = confirm(`确定要删除笔记「${noteTitle}」吗？删除后无法恢复哦~`);
      if (!isConfirm) return; // 用户取消则终止

      // 步骤2：调用后端删除接口
      try {
        const user = window.userModule.getCurrentUser();
        if (!user) {
          window.api.showToast('请先登录', 'error');
          return;
        }

        // 将userId作为query参数传递
        const userId = user.userId || user.guestId;
        const url = `/collection/${noteId}?userId=${encodeURIComponent(userId)}`;
        
        const responseData = await window.api.fetchRaw(url, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });

        if (responseData.code === 0) {
          // 步骤3：删除成功，移除页面上的笔记条目
          noteItem.remove();
          
          // 如果收藏列表为空，显示提示
          const container = document.getElementById('collectionsList');
          if (container && container.querySelectorAll('.collection-item').length === 0) {
            container.innerHTML = '<p class="empty-tip">暂无收藏，请先解析并收藏小红书链接</p>';
          }

          window.api.showToast('笔记删除成功', 'success');
          
          // 刷新生成行程页面的收藏复选框
          const user = window.userModule.getCurrentUser();
          if (user) {
            try {
              const data = await window.api.get('/collection/list', { userId: user.userId });
              updateCollectionCheckboxes(data.collections || []);
            } catch (error) {
              // 忽略刷新复选框的错误
            }
          }
        } else {
          window.api.showToast(responseData.msg || '删除失败', 'error');
        }
      } catch (error) {
        window.api.showToast(`删除失败：${error.message}`, 'error');
      }
    }
  });
}

/**
 * 设置解析结果标签管理功能（删除标签、添加标签）
 * 临时存储解析结果的标签（收藏时再同步到后端）
 */
function setupParseResultTagManagement() {
  // 1. 监听解析结果的"删除标签"按钮
  document.addEventListener('click', (e) => {
    if (e.target.matches('#parseResultTags .tag-delete-btn')) {
      e.stopPropagation(); // 阻止事件冒泡
      
      const deleteBtn = e.target;
      const tag = deleteBtn.dataset.tag;
      const tagItem = deleteBtn.closest('.tag-item');
      
      if (!tagItem) return;

      // 前端移除标签 + 更新临时数组
      tagItem.remove();
      tempParseTags = tempParseTags.filter(t => t !== tag);
      
      // 如果标签列表为空，显示提示
      const tagsContainer = document.getElementById('parseResultTags');
      if (tagsContainer && tagsContainer.querySelectorAll('.tag-item').length === 0) {
        tagsContainer.innerHTML = '<span class="empty-tip">暂无标签</span>';
      }
    }
  });

  // 2. 监听解析结果的"添加标签"按钮
  document.addEventListener('click', (e) => {
    if (e.target.matches('#parseResultTagAddBtn')) {
      e.stopPropagation(); // 阻止事件冒泡
      
      const input = document.getElementById('parseResultTagInput');
      const newTag = input.value.trim();
      const tagsContainer = document.getElementById('parseResultTags');

      if (!input || !tagsContainer) return;

      // 验证：非空
      if (!newTag) {
        window.api.showToast('请输入标签内容', 'error');
        return;
      }

      // 验证：标签长度
      if (newTag.length > 20) {
        window.api.showToast('标签长度不能超过20个字符', 'error');
        return;
      }

      // 验证：不重复
      if (tempParseTags.includes(newTag)) {
        window.api.showToast('该标签已存在', 'error');
        input.value = '';
        return;
      }

      // 前端添加标签 + 更新临时数组
      // 移除"暂无标签"提示
      const emptyTip = tagsContainer.querySelector('.empty-tip');
      if (emptyTip) {
        emptyTip.remove();
      }

      const newTagItem = document.createElement('span');
      newTagItem.className = 'tag-item';
      newTagItem.innerHTML = `${window.utils.escapeHtml(newTag)} <button class="tag-delete-btn" data-tag="${window.utils.escapeHtml(newTag)}" title="删除标签">×</button>`;
      tagsContainer.appendChild(newTagItem);
      tempParseTags.push(newTag);
      input.value = '';
    }
  });

  // 3. 监听解析结果标签输入框的回车键
  document.addEventListener('keypress', (e) => {
    if (e.target.matches('#parseResultTagInput') && e.key === 'Enter') {
      e.preventDefault();
      const addBtn = document.getElementById('parseResultTagAddBtn');
      if (addBtn) {
        addBtn.click();
      }
    }
  });
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

  // 设置解析结果标签的增删逻辑
  setupParseResultTagManagement();
}

// 导出收藏相关函数
window.collectionModule = {
  loadCollections,
  getSelectedCollections,
  initCollection
};

