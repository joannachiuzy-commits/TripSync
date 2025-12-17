/**
 * 行程生成模块（简化版）
 * 只保留核心功能：选择收藏 → 输入天数 → 生成行程 → 显示结果
 */

let currentTripId = null;

/**
 * 生成行程
 */
async function generateTrip() {
  try {
    // 检查关键模块是否存在
    if (!window.userModule) {
      throw new Error('userModule 模块未加载，请检查脚本加载顺序');
    }

    if (!window.collectionModule) {
      throw new Error('collectionModule 模块未加载，请检查脚本加载顺序');
    }

    if (!window.api) {
      throw new Error('api 模块未加载，请检查脚本加载顺序');
    }

    // 检查是否登录
    if (!window.userModule.isLoggedIn()) {
      window.userModule.showLoginGuideModal();
      return;
    }

    // 获取选中的收藏
    const selectedCollections = window.collectionModule.getSelectedCollections();
    
    if (selectedCollections.length === 0) {
      window.api.showToast('请至少选择一个收藏', 'error');
      return;
    }

    // 获取天数
    const daysInput = document.getElementById('tripDays');
    if (!daysInput) {
      throw new Error('未找到行程天数输入框，请检查HTML');
    }

    const days = parseInt(daysInput.value);
    if (!days || days < 1) {
      window.api.showToast('请输入有效的行程天数', 'error');
      return;
    }

    // 获取预算
    const budgetInput = document.getElementById('tripBudget');
    const budget = budgetInput ? budgetInput.value.trim() : '';

    // 获取用户信息
    const user = window.userModule.getCurrentUser();
    if (!user) {
      window.api.showToast('请先登录', 'error');
      return;
    }

    // 获取模型类型
    const modelTypeSelect = document.getElementById('modelTypeSelect');
    const modelType = modelTypeSelect ? modelTypeSelect.value : 'auto';

    // 调用生成接口
    const data = await window.api.post('/trip/generate', {
      userId: user.userId,
      collectionIds: selectedCollections.map(c => c.collectionId),
      days,
      budget,
      modelType,
      preference: '' // 简化版不传偏好
    });

    currentTripId = data.tripId;
    
    // 显示生成结果
    displayItinerary(data.itinerary);
    
    // 显示成功提示
    const modelName = data.modelName || 'AI';
    window.api.showToast(`行程生成成功（使用 ${modelName}）`, 'success');

    // 刷新行程列表
    setTimeout(() => {
      if (window.tripEditModule && window.tripEditModule.loadTripList) {
        window.tripEditModule.loadTripList();
      }
      if (window.shareModule && window.shareModule.loadTripList) {
        window.shareModule.loadTripList();
      }
    }, 500);
  } catch (error) {
    // 错误处理
    if (window.api && window.api.hideLoadingOverlay) {
      window.api.hideLoadingOverlay();
    }
    
    const emptyState = document.getElementById('emptyState');
    if (emptyState) {
      emptyState.style.display = 'flex';
      emptyState.innerHTML = `
        <span class="empty-icon">❌</span>
        <p>生成失败：${error.message || '请重试'}</p>
      `;
    }
    
    if (window.api && window.api.showToast) {
      window.api.showToast(error.message || '生成行程失败', 'error');
    }
    console.error('生成行程错误：', error);
  }
}

/**
 * 展示行程
 * @param {Array} itinerary 行程数据
 */
function displayItinerary(itinerary) {
  // 隐藏空状态，显示行程容器
  const emptyState = document.getElementById('emptyState');
  const tripContainer = document.getElementById('tripContainer');
  
  if (emptyState) {
    emptyState.style.display = 'none';
  }
  
  if (tripContainer) {
    tripContainer.style.display = 'block';
  }
  
  const container = document.getElementById('generatedItinerary');
  if (!container) return;

  if (!itinerary || itinerary.length === 0) {
    container.innerHTML = '<p class="empty-tip">未生成行程数据</p>';
    return;
  }

  // 渲染行程（简单显示，不支持编辑）
  container.innerHTML = itinerary.map((day) => {
    const dayItems = day.items || [];
    return `
      <div class="day-section" data-day="${day.day}">
        <div class="day-header">第 ${day.day} 天 ${day.date ? `(${day.date})` : ''}</div>
        <div class="day-items-container">
          ${dayItems.length > 0 ? dayItems.map((item) => `
            <div class="trip-item">
              <span class="trip-time">${item.time || '00:00'}</span>
              <div class="trip-content">
                <h4 class="trip-place">${item.place || '未设置地点'}</h4>
                <p class="trip-description">${item.description || ''}</p>
              </div>
            </div>
          `).join('') : '<p class="empty-tip">暂无安排</p>'}
        </div>
      </div>
    `;
  }).join('');
}

// 标记是否已初始化
let isTripGenerateInitialized = false;

/**
 * 初始化行程生成模块
 */
function initTripGenerate() {
  // 如果已初始化，跳过
  if (isTripGenerateInitialized) {
    return;
  }

  try {
    // 检查关键模块是否存在
    if (!window.collectionModule) {
      throw new Error('collectionModule 模块未加载，请检查脚本加载顺序');
    }

    if (!window.userModule) {
      throw new Error('userModule 模块未加载，请检查脚本加载顺序');
    }

    // 检查按钮元素是否存在
    const generateBtn = document.getElementById('generateTripBtn');
    if (!generateBtn) {
      throw new Error('未找到ID为 generateTripBtn 的按钮元素，请检查HTML');
    }

    // 绑定点击事件
    generateBtn.removeEventListener('click', generateTrip);
    generateBtn.addEventListener('click', generateTrip);
    
    isTripGenerateInitialized = true;
  } catch (error) {
    console.error('❌ 行程生成模块初始化失败：', error.message);
    if (window.api && window.api.showToast) {
      window.api.showToast(`初始化失败：${error.message}`, 'error');
    }
  }
}

// 导出行程生成相关函数
window.tripGenerateModule = {
  generateTrip,
  displayItinerary,
  initTripGenerate
};

// 页面加载时检查当前激活的标签是否为"生成行程"，如果是则初始化
function checkAndInitTripGenerate() {
  const generateTab = document.getElementById('generateTab');
  const generateTabBtn = document.querySelector('.tab-btn[data-tab="generate"]');
  
  if (generateTab && generateTab.classList.contains('active')) {
    initTripGenerate();
  } else if (generateTabBtn && generateTabBtn.classList.contains('active')) {
    initTripGenerate();
  }
}

// 页面加载完成后检查并初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkAndInitTripGenerate, 100);
  });
} else {
  setTimeout(checkAndInitTripGenerate, 100);
}

