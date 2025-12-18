/**
 * 行程生成模块
 * 处理 AI 生成行程、展示生成结果
 */

let currentTripId = null;
let currentItineraryData = null; // 保存当前生成的行程原始数据

/**
 * 生成行程
 * 【游客权限逻辑】游客模式下需要登录才能生成行程
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

    // 【游客权限逻辑】检查是否为游客模式，游客无法生成行程
    if (!window.userModule.isLoggedIn()) {
      window.userModule.showLoginGuideModal();
      return; // 阻止后续操作
    }

    const selectedCollections = window.collectionModule.getSelectedCollections();
    
    if (selectedCollections.length === 0) {
      window.api.showToast('请至少选择一个收藏', 'error');
      return;
    }

    const daysInput = document.getElementById('tripDays');
    const budgetInput = document.getElementById('tripBudget');
    
    if (!daysInput) {
      throw new Error('未找到行程天数输入框，请检查HTML');
    }

    const days = parseInt(daysInput.value);
    const budget = budgetInput ? budgetInput.value.trim() : '';

    if (!days || days < 1) {
      window.api.showToast('请输入有效的行程天数', 'error');
      return;
    }

    const user = window.userModule.getCurrentUser();
    if (!user) {
      window.api.showToast('请先登录', 'error');
      return;
    }

    // 获取用户选择的模型类型
    const modelTypeSelect = document.getElementById('modelTypeSelect');
    const modelType = modelTypeSelect ? modelTypeSelect.value : 'auto';

    // 获取行程偏好
    const preferenceInput = document.getElementById('preferenceInput');
    const preference = preferenceInput ? preferenceInput.value.trim() : '';

    const data = await window.api.post('/trip/generate', {
      userId: user.userId,
      collectionIds: selectedCollections.map(c => c.collectionId),
      days,
      budget,
      modelType, // 传递模型类型参数
      preference // 传递偏好参数
    });

    currentTripId = data.tripId;
    
    // 保存行程原始数据
    currentItineraryData = data.itinerary;
    
    // 显示生成结果
    displayItinerary(data.itinerary);
    
    const generateResult = document.getElementById('generateResult');
    if (generateResult) {
      generateResult.style.display = 'block';
      // 如果有行程内容，显示保存按钮
      if (data.itinerary && data.itinerary.length > 0) {
        showSaveTripButton();
      }
    }
    // 显示生成成功提示，包含使用的模型信息
    const modelName = data.modelName || 'AI';
    window.api.showToast(`行程生成成功（使用 ${modelName}）`, 'success');

    // 刷新行程列表（编辑页面和分享页面）
    setTimeout(() => {
      if (window.tripEditModule && window.tripEditModule.loadTripList) {
        window.tripEditModule.loadTripList();
      }
      if (window.shareModule && window.shareModule.loadTripList) {
        window.shareModule.loadTripList();
      }
    }, 500);
  } catch (error) {
    // 捕获前置逻辑错误（如模块未定义、参数错误）
    if (window.api && window.api.hideLoadingOverlay) {
      window.api.hideLoadingOverlay(); // 隐藏可能残留的加载遮罩
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
  const container = document.getElementById('generatedItinerary');
  
  if (!itinerary || itinerary.length === 0) {
    container.innerHTML = '<p class="empty-tip">未生成行程数据</p>';
    // 隐藏保存按钮
    hideSaveTripButton();
    return;
  }

  container.innerHTML = itinerary.map(day => `
    <div class="day-section">
      <div class="day-header">第 ${day.day} 天 ${day.date ? `(${day.date})` : ''}</div>
      ${day.items && day.items.length > 0 ? day.items.map(item => `
        <div class="trip-item">
          <div class="trip-time">${item.time}</div>
          <div class="trip-content">
            <div class="trip-place">${item.place || '未设置地点'}</div>
            <div class="trip-description">${item.description || ''}</div>
          </div>
        </div>
      `).join('') : '<p class="empty-tip">暂无安排</p>'}
    </div>
  `).join('');
}

// 标记是否已初始化，避免重复绑定
let isTripGenerateInitialized = false;

/**
 * 初始化行程偏好模块交互逻辑
 */
function initPreferenceModule() {
  const preferenceTags = document.querySelectorAll('.preference-tag');
  const preferenceInput = document.getElementById('preferenceInput');
  const clearBtn = document.getElementById('clearPreferenceBtn');
  const agentTip = document.getElementById('agentTip');

  if (!preferenceInput || !clearBtn || !agentTip) {
    console.warn('⚠️  行程偏好模块元素未找到，跳过初始化');
    return;
  }

  // 1. 快捷标签点击逻辑
  preferenceTags.forEach(tag => {
    tag.addEventListener('click', () => {
      tag.classList.toggle('active');
      
      // 获取所有激活的标签文本
      const activeTags = Array.from(preferenceTags)
        .filter(t => t.classList.contains('active'))
        .map(t => t.dataset.text);
      
      // 获取当前输入框内容（去除已存在的标签文本）
      let currentValue = preferenceInput.value.trim();
      
      // 如果输入框为空，直接填充激活的标签
      if (!currentValue) {
        preferenceInput.value = activeTags.join('，');
      } else {
        // 如果输入框有内容，检查是否需要添加新标签
        const currentTags = currentValue.split('，').map(t => t.trim());
        activeTags.forEach(tagText => {
          if (!currentTags.includes(tagText)) {
            currentValue += '，' + tagText;
          }
        });
        preferenceInput.value = currentValue;
      }
      
      // 显示Agent反馈提示
      agentTip.style.display = 'block';
      setTimeout(() => {
        agentTip.style.display = 'none';
      }, 3000);
    });
  });

  // 2. 清空按钮逻辑
  clearBtn.addEventListener('click', () => {
    preferenceInput.value = '';
    preferenceTags.forEach(tag => tag.classList.remove('active'));
  });

  // 3. 输入框输入时，如果内容变化，自动取消相关标签的激活状态
  preferenceInput.addEventListener('input', () => {
    const inputValue = preferenceInput.value.trim();
    preferenceTags.forEach(tag => {
      const tagText = tag.dataset.text;
      if (!inputValue.includes(tagText)) {
        tag.classList.remove('active');
      }
    });
  });

  console.log('✅ 行程偏好模块交互逻辑初始化成功');
}

/**
 * 显示保存行程按钮
 */
function showSaveTripButton() {
  const saveContainer = document.querySelector('.save-trip-container');
  if (saveContainer) {
    saveContainer.style.display = 'flex';
    // 重置按钮状态
    const saveBtn = document.getElementById('saveGeneratedTripBtn');
    const saveTip = document.querySelector('.save-trip-container .save-trip-tip');
    if (saveBtn) {
      saveBtn.textContent = '保存行程';
      saveBtn.disabled = false;
    }
    if (saveTip) {
      saveTip.style.display = 'none';
    }
  }
}

/**
 * 隐藏保存行程按钮
 */
function hideSaveTripButton() {
  const saveContainer = document.querySelector('.save-trip-container');
  if (saveContainer) {
    saveContainer.style.display = 'none';
  }
}

/**
 * 处理保存行程
 */
function handleSaveTrip() {
  try {
    // 获取所有需要保存的数据
    const daysInput = document.getElementById('tripDays');
    const budgetInput = document.getElementById('tripBudget');
    const modelTypeSelect = document.getElementById('modelTypeSelect');
    const preferenceInput = document.getElementById('preferenceInput');
    const generatedItinerary = document.getElementById('generatedItinerary');
    
    if (!daysInput || !generatedItinerary || !currentItineraryData) {
      window.api.showToast('保存失败：缺少必要数据', 'error');
      return;
    }
    
    const tripData = {
      days: parseInt(daysInput.value) || 0,
      budget: budgetInput ? budgetInput.value.trim() : '',
      modelType: modelTypeSelect ? modelTypeSelect.value : 'auto',
      preference: preferenceInput ? preferenceInput.value.trim() : '',
      itinerary: currentItineraryData, // 保存原始行程数据
      itineraryHtml: generatedItinerary.innerHTML, // 保存HTML内容
      savedAt: new Date().toISOString() // 保存时间
    };
    
    // 存储到localStorage
    localStorage.setItem('validated_trip', JSON.stringify(tripData));
    
    // 更新按钮状态
    const saveBtn = document.getElementById('saveGeneratedTripBtn');
    const saveTip = document.querySelector('.save-trip-container .save-trip-tip');
    
    if (saveBtn) {
      saveBtn.textContent = '已生效';
      saveBtn.disabled = true;
    }
    
    if (saveTip) {
      saveTip.style.display = 'inline';
    }
    
    window.api.showToast('行程已保存', 'success');
    console.log('✅ 行程已保存到localStorage');
  } catch (error) {
    console.error('保存行程错误：', error);
    window.api.showToast('保存失败：' + (error.message || '未知错误'), 'error');
  }
}

/**
 * 初始化行程生成模块
 */
function initTripGenerate() {
  // 如果已初始化，跳过（避免重复绑定事件）
  if (isTripGenerateInitialized) {
    console.log('✅ 行程生成模块已初始化，跳过重复初始化');
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

    // 绑定点击事件（先移除可能存在的旧监听器，避免重复绑定）
    generateBtn.removeEventListener('click', generateTrip);
    generateBtn.addEventListener('click', generateTrip);
    
    // 初始化保存行程按钮
    const saveBtn = document.getElementById('saveGeneratedTripBtn');
    if (saveBtn) {
      saveBtn.removeEventListener('click', handleSaveTrip);
      saveBtn.addEventListener('click', handleSaveTrip);
    }
    
    // 初始化偏好模块交互逻辑
    initPreferenceModule();
    
    isTripGenerateInitialized = true;
    console.log('✅ 行程生成按钮点击事件绑定成功');
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
  initTripGenerate,
  handleSaveTrip,
  showSaveTripButton,
  hideSaveTripButton
};

// 页面加载时检查当前激活的标签是否为"生成行程"，如果是则初始化
function checkAndInitTripGenerate() {
  // 检查生成行程标签页是否激活
  const generateTab = document.getElementById('generateTab');
  const generateTabBtn = document.querySelector('.tab-btn[data-tab="generate"]');
  
  if (generateTab && generateTab.classList.contains('active')) {
    // 当前激活的是生成行程标签，执行初始化
    initTripGenerate();
  } else if (generateTabBtn && generateTabBtn.classList.contains('active')) {
    // 按钮处于激活状态，也执行初始化
    initTripGenerate();
  }
}

// 页面加载完成后检查并初始化（作为备用机制）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // 延迟检查，确保 main.js 的 initTabs() 已执行
    setTimeout(checkAndInitTripGenerate, 100);
  });
} else {
  // 文档已加载完成，延迟检查确保标签页状态已恢复
  setTimeout(checkAndInitTripGenerate, 100);
}

