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
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-gray-500 mb-1">名称</p>
            <p class="text-lg font-semibold text-gray-800">{{ result.name || '未提取到' }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500 mb-1">人均</p>
            <p class="text-lg font-semibold text-gray-800">{{ result.average || '未提取到' }}</p>
          </div>
          <div class="md:col-span-2">
            <p class="text-sm text-gray-500 mb-1">地址</p>
            <p class="text-lg font-semibold text-gray-800 break-all">
              {{ result.address || '未提取到' }}
            </p>
          </div>
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
            <span v-if="!result.keywords?.length" class="text-gray-500 text-sm">未提取到</span>
          </div>
        </div>

        <!-- 笔记图片展示 -->
        <div v-if="result.images && Array.isArray(result.images) && result.images.length > 0">
          <p class="text-sm text-gray-500 mb-2">笔记图片：</p>
          <div class="flex gap-2">
            <img
              v-for="(imgUrl, idx) in result.images.slice(0, 3)"
              :key="idx"
              :src="imgUrl"
              :alt="`笔记图片 ${idx + 1}`"
              class="w-[100px] h-[100px] object-cover rounded-lg border border-gray-200"
              @error="handleImageError"
              loading="lazy"
            />
          </div>
        </div>

        <div class="bg-gray-50 rounded-md p-3 text-sm text-gray-600">
          <p class="font-medium text-gray-700">原始摘要</p>
          <p class="mt-1 whitespace-pre-line">{{ result.raw?.description || result.raw?.title }}</p>
        </div>
      </div>

      <div v-else class="text-gray-500 text-sm">
        粘贴链接并点击“解析小红书”查看结果
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

// 处理图片加载错误
const handleImageError = (event) => {
  // 图片加载失败时，隐藏该图片或显示占位图
  event.target.style.display = 'none'
  console.warn('图片加载失败:', event.target.src)
}

// 解析链接，调用后端接口
const parseLink = async () => {
  if (!xhsUrl.value) return
  loading.value = true
  error.value = ''
  result.value = null

  try {
    // 调用后端解析接口
    const { data } = await axios.post('http://localhost:3001/api/xhs/parse', {
      url: xhsUrl.value.trim()
    })
    result.value = data
  } catch (err) {
    console.error('解析失败', err)
    error.value =
      err?.response?.data?.error ||
      '解析失败，请确认链接有效并检查后端服务是否已启动'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.trip-editor input::placeholder {
  color: #9ca3af;
}
</style>

