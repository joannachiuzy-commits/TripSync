<template>
  <div class="trip-editor space-y-6">
    <!-- 标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-800">行程编辑</h1>
        <p class="text-gray-600 mt-1">粘贴小红书链接，一键提取景点/餐厅信息</p>
      </div>
      <span class="text-sm text-gray-500">实验功能 · 需联网</span>
    </div>

    <!-- 输入区域 -->
    <div class="bg-white rounded-lg shadow p-6 space-y-4">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        小红书链接
      </label>
      <div class="flex flex-col md:flex-row gap-3">
        <input
          v-model="xhsUrl"
          type="text"
          placeholder="粘贴示例：https://www.xiaohongshu.com/explore/65f96b6f000000001300b2a4"
          class="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          @paste="handlePaste"
        />
        <button
          @click="parseLink"
          :disabled="loading || !xhsUrl"
          class="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {{ loading ? '解析中...' : '解析小红书' }}
        </button>
      </div>
      <p class="text-xs text-gray-500">
        已处理常见反爬（UA伪装）。若解析失败，可刷新后重试或更换链接。
      </p>
    </div>

    <!-- 结果展示 -->
    <div class="bg-white rounded-lg shadow p-6 space-y-4">
      <h2 class="text-xl font-semibold text-gray-800">解析结果</h2>

      <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {{ error }}
      </div>

      <div v-if="result" class="space-y-3">
        <!-- 【简化字段】仅显示名称、content、体验关键词 -->
        <div>
          <p class="text-sm text-gray-500 mb-1">名称</p>
          <p class="text-lg font-semibold text-gray-800">{{ result.name || '暂无法提取' }}</p>
        </div>

        <div>
          <p class="text-sm text-gray-500 mb-1">体验关键词</p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="(tag, idx) in result.keywords"
              :key="idx"
              class="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm"
            >
              {{ tag }}
            </span>
            <span v-if="!result.keywords?.length" class="text-gray-500 text-sm">暂无法提取</span>
          </div>
        </div>

        <!-- 【修复content提取】显示笔记正文 -->
        <div class="bg-gray-50 rounded-md p-3 text-sm text-gray-600">
          <p class="font-medium text-gray-700 mb-2">笔记正文</p>
          <p class="mt-1 whitespace-pre-line">{{ result.raw?.content || '暂无法获取笔记内容' }}</p>
        </div>

        <!-- 【排查6】临时添加原始HTML预览（仅开发环境显示） -->
        <div v-if="result.debug" class="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-xs text-gray-600">
          <p class="font-medium text-yellow-800 mb-2">🔍 调试信息（仅开发环境）</p>
          <p class="mb-1">原始HTML长度: {{ result.debug.rawHtmlLength }} 字符</p>
          <p class="mb-1">文本内容长度: {{ result.debug.textContentLength }} 字符</p>
          <p class="mb-1">rawContent长度: {{ result.debug.rawContentLength }} 字符</p>
          <details class="mt-2">
            <summary class="cursor-pointer text-yellow-700 hover:text-yellow-900">查看原始HTML预览（前1000字符）</summary>
            <pre class="mt-2 p-2 bg-white rounded border border-yellow-300 overflow-auto max-h-40 text-xs">{{ result.debug.rawHtmlPreview }}</pre>
          </details>
        </div>

        <!-- 保存到第三方攻略库按钮 -->
        <div class="pt-4 border-t">
          <button
            @click="saveToSiteLibrary"
            :disabled="saving"
            class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {{ saving ? '保存中...' : '保存到第三方攻略库' }}
          </button>
          <span v-if="saveSuccess" class="ml-4 text-green-600 text-sm">✓ 保存成功！</span>
        </div>
      </div>

      <div v-else class="text-gray-500 text-sm">
        粘贴链接并点击"解析小红书"查看结果
      </div>
    </div>

    <!-- 测试链接 -->
    <div class="bg-blue-50 border border-blue-100 text-blue-800 px-4 py-3 rounded text-sm">
      <p class="font-semibold mb-1">测试用小红书链接（可直接复制）</p>
      <ul class="list-disc list-inside space-y-1">
        <li>https://www.xiaohongshu.com/explore/65f96b6f000000001300b2a4</li>
        <li>https://www.xiaohongshu.com/explore/63f7fb9a0000000013001d1a</li>
      </ul>
      <p class="text-xs text-blue-700 mt-1">以上链接仅用于本地解析测试，请确保网络可访问小红书。</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'

// 小红书链接
const xhsUrl = ref('')
// 解析结果
const result = ref(null)
// 加载状态
const loading = ref(false)
// 错误信息
const error = ref('')
// 保存状态
const saving = ref(false)
const saveSuccess = ref(false)

// 处理粘贴事件，自动提取小红书链接
const handlePaste = (event) => {
  // 获取粘贴的内容
  const pastedText = (event.clipboardData || window.clipboardData).getData('text')
  
  // 使用正则表达式提取以 https://www.xiaohongshu.com/ 开头的链接
  const xhsLinkPattern = /https:\/\/www\.xiaohongshu\.com\/[^\s\n]+/g
  const matches = pastedText.match(xhsLinkPattern)
  
  // 如果找到小红书链接，自动填充到输入框（只取第一个链接）
  if (matches && matches.length > 0) {
    // 阻止默认粘贴行为
    event.preventDefault()
    // 设置提取到的链接
    xhsUrl.value = matches[0]
  }
}

// 【回滚】删除图片错误处理函数

// 解析链接，调用后端接口
const parseLink = async () => {
  if (!xhsUrl.value) return
  loading.value = true
  error.value = ''
  result.value = null
  saveSuccess.value = false

  try {
    // 【统一修复7】解析小红书链接 - 添加超时和统一错误处理
    const { data } = await axios.post('http://localhost:3008/api/xhs/parse', {
      url: xhsUrl.value.trim()
    }, {
      timeout: 120000 // 120秒超时（解析可能需要较长时间）
    })
    result.value = data
  } catch (err) {
    console.error('解析失败', err)
    if (err.response) {
      error.value = `解析失败: ${err.response.data?.error || err.response.data?.details || err.response.statusText || '服务器错误'}`
    } else if (err.request) {
      error.value = '解析失败：无法连接到后端服务（请确保后端服务在3008端口运行）'
    } else {
      error.value = `解析失败: ${err.message || '未知错误'}`
    }
  } finally {
    loading.value = false
  }
}

// 保存到第三方攻略库
const saveToSiteLibrary = async () => {
  if (!result.value || !xhsUrl.value) return
  
  saving.value = true
  saveSuccess.value = false
  
  try {
    // 构建保存数据（【回滚】删除图片相关字段）
    const siteData = {
      site_name: result.value.name || '未命名站点',
      xhs_url: xhsUrl.value.trim(),
      content: result.value.raw?.content || result.value.raw?.description || result.value.raw?.title || '', // 【修复字段混淆】优先使用content字段（已移除address）
      tags: result.value.keywords || [],
      notes: ''
    }
    
    console.log('💾 准备保存站点数据:', siteData) // 调试日志
    
    // 【统一修复8】保存到第三方攻略库 - 添加超时和统一错误处理
    await axios.post('http://localhost:3008/api/xhs/sites', siteData, {
      timeout: 10000
    })
    
    saveSuccess.value = true
    // 3秒后隐藏成功提示
    setTimeout(() => {
      saveSuccess.value = false
    }, 3000)
  } catch (err) {
    console.error('保存失败', err)
    error.value = err?.response?.data?.error || '保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.trip-editor input::placeholder {
  color: #9ca3af;
}
</style>

