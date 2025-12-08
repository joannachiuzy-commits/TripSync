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
    // 调用后端API获取攻略列表
    const response = await axios.get('/api/guides')
    guides.value = response.data
  } catch (err) {
    error.value = '获取攻略列表失败，请检查后端服务是否正常运行'
    console.error('获取攻略失败:', err)
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


