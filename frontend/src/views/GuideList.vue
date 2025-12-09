<template>
  <div class="guide-list">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold text-gray-800">旅游攻略</h1>
      <button
        @click="fetchGuides"
        class="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
      >
        刷新列表
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p class="mt-4 text-gray-600">加载中...</p>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {{ error }}
    </div>

    <!-- 攻略列表 -->
    <div v-if="!loading && guides.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="guide in guides"
        :key="guide.id"
        class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
        @click="viewGuide(guide.id)"
      >
        <div class="h-48 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
          <span class="text-6xl">🌍</span>
        </div>
        <div class="p-6">
          <h3 class="text-xl font-semibold mb-2 text-gray-800">{{ guide.title }}</h3>
          <p class="text-gray-600 mb-4 line-clamp-2">{{ guide.description }}</p>
          <div class="flex items-center justify-between text-sm text-gray-500">
            <span>📍 {{ guide.location }}</span>
            <span>{{ formatDate(guide.created_at) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && guides.length === 0" class="text-center py-12 bg-white rounded-lg shadow-md">
      <div class="text-6xl mb-4">📝</div>
      <p class="text-gray-600 text-lg">暂无攻略，快来创建第一个吧！</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

// 响应式数据
const guides = ref([]) // 攻略列表
const loading = ref(false) // 加载状态
const error = ref('') // 错误信息

// 获取攻略列表
const fetchGuides = async () => {
  loading.value = true
  error.value = ''
  
  try {
    // 【统一修复1】调用后端API获取攻略列表 - 使用完整URL和端口3008
    const response = await axios.get('http://localhost:3008/api/guides', {
      timeout: 10000 // 10秒超时
    })
    
    // 【统一修复2】适配后端统一返回格式：{ code: 200, data: [...], msg: "成功" }
    if (response.data && response.data.code === 200) {
      guides.value = response.data.data || []
      error.value = '' // 成功时清空错误信息
    } else {
      // 兼容旧格式（直接返回数组）
      guides.value = Array.isArray(response.data) ? response.data : []
      error.value = ''
    }
    
    // 如果没有数据，显示友好提示（不是错误）
    if (guides.value.length === 0) {
      error.value = '' // 空列表不是错误
    }
  } catch (err) {
    // 【修复2】改进错误处理，显示更详细的错误信息
    console.error('获取攻略失败:', err)
    if (err.response) {
      // 服务器返回了错误响应
      error.value = `获取攻略列表失败: ${err.response.data?.error || err.response.statusText || '服务器错误'}`
    } else if (err.request) {
      // 请求已发出但没有收到响应
      error.value = '获取攻略列表失败：无法连接到后端服务（请确保后端服务在3008端口运行）'
    } else {
      // 其他错误
      error.value = `获取攻略列表失败: ${err.message || '未知错误'}`
    }
    guides.value = [] // 确保失败时清空列表
  } finally {
    loading.value = false
  }
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN')
}

// 查看攻略详情（暂时只是打印，后续可以添加详情页）
const viewGuide = (id) => {
  console.log('查看攻略:', id)
  // TODO: 跳转到攻略详情页
}

// 组件挂载时获取攻略列表
onMounted(() => {
  fetchGuides()
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>


