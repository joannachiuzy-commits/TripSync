<template>
  <div class="site-library space-y-6">
    <!-- 标题和搜索 -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-800">站点库管理</h1>
        <p class="text-gray-600 mt-1">管理保存的小红书站点信息</p>
      </div>
      <div class="flex gap-2">
        <input
          v-model="searchKeyword"
          type="text"
          placeholder="搜索站点名称、内容..."
          class="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          @input="handleSearch"
        />
        <select
          v-model="selectedTag"
          class="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          @change="handleSearch"
        >
          <option value="">所有标签</option>
          <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
        </select>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p class="mt-4 text-gray-600">加载中...</p>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
      {{ error }}
    </div>

    <!-- 站点列表 -->
    <div v-if="!loading && sites.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="site in sites"
        :key="site.id"
        class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
      >
        <!-- 图片展示 -->
        <div v-if="site.images && site.images.length > 0" class="h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
          <img
            :src="site.images[0]"
            :alt="site.site_name"
            class="w-full h-full object-cover"
            @error="handleImageError"
          />
        </div>
        <div v-else class="h-48 bg-gray-100 flex items-center justify-center">
          <span class="text-gray-400 text-4xl">📝</span>
        </div>

        <!-- 站点信息 -->
        <div class="p-6 space-y-3">
          <div>
            <h3 class="text-xl font-semibold text-gray-800 mb-1">{{ site.site_name }}</h3>
            <a
              :href="site.xhs_url"
              target="_blank"
              class="text-sm text-primary-600 hover:underline"
            >
              查看原链接 →
            </a>
          </div>

          <!-- 标签 -->
          <div v-if="site.tags && site.tags.length > 0" class="flex flex-wrap gap-2">
            <span
              v-for="tag in site.tags"
              :key="tag"
              class="px-2 py-1 bg-primary-50 text-primary-700 rounded text-xs"
            >
              {{ tag }}
            </span>
          </div>

          <!-- 内容预览 -->
          <p v-if="site.content" class="text-sm text-gray-600 line-clamp-2">
            {{ site.content }}
          </p>

          <!-- 备注 -->
          <p v-if="site.notes" class="text-sm text-gray-500 italic">
            备注：{{ site.notes }}
          </p>

          <!-- 操作按钮 -->
          <div class="flex gap-2 pt-2 border-t">
            <button
              @click="editSite(site)"
              class="flex-1 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm"
            >
              编辑
            </button>
            <button
              @click="deleteSite(site.id)"
              class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && sites.length === 0" class="text-center py-12 bg-white rounded-lg shadow-md">
      <div class="text-6xl mb-4">📚</div>
      <p class="text-gray-600 text-lg">暂无站点，快去保存一些吧！</p>
      <router-link
        to="/editor"
        class="inline-block mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
      >
        去解析页面 →
      </router-link>
    </div>

    <!-- 编辑弹窗 -->
    <div
      v-if="editingSite"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeEditModal"
    >
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">编辑站点</h2>

        <div class="space-y-4">
          <!-- 站点名称 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">站点名称</label>
            <input
              v-model="editForm.site_name"
              type="text"
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <!-- 标签 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">标签（用逗号分隔）</label>
            <input
              v-model="editForm.tagsText"
              type="text"
              placeholder="例如：美食,东京,日料"
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <!-- 备注 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea
              v-model="editForm.notes"
              rows="3"
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            ></textarea>
          </div>

          <!-- 按钮 -->
          <div class="flex gap-2 pt-4">
            <button
              @click="saveEdit"
              class="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              保存
            </button>
            <button
              @click="closeEditModal"
              class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'

// 站点列表
const sites = ref([])
// 加载状态
const loading = ref(false)
// 错误信息
const error = ref('')
// 搜索关键词
const searchKeyword = ref('')
// 选中的标签
const selectedTag = ref('')
// 编辑中的站点
const editingSite = ref(null)
// 编辑表单
const editForm = ref({
  site_name: '',
  tagsText: '',
  notes: ''
})

// 所有标签（用于筛选）
const allTags = computed(() => {
  const tagSet = new Set()
  sites.value.forEach(site => {
    if (site.tags && Array.isArray(site.tags)) {
      site.tags.forEach(tag => tagSet.add(tag))
    }
  })
  return Array.from(tagSet).sort()
})

// 获取站点列表
const fetchSites = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const params = {}
    if (searchKeyword.value) {
      params.search = searchKeyword.value
    }
    if (selectedTag.value) {
      params.tag = selectedTag.value
    }
    
    const { data } = await axios.get('http://localhost:3001/api/xhs/sites', { params })
    sites.value = data || []
  } catch (err) {
    console.error('获取站点列表失败', err)
    error.value = '获取站点列表失败，请检查后端服务是否已启动'
  } finally {
    loading.value = false
  }
}

// 搜索处理
const handleSearch = () => {
  fetchSites()
}

// 编辑站点
const editSite = (site) => {
  editingSite.value = site
  editForm.value = {
    site_name: site.site_name || '',
    tagsText: site.tags ? site.tags.join(',') : '',
    notes: site.notes || ''
  }
}

// 保存编辑
const saveEdit = async () => {
  if (!editingSite.value) return
  
  try {
    const tags = editForm.value.tagsText
      .split(',')
      .map(t => t.trim())
      .filter(t => t)
    
    await axios.put(`http://localhost:3001/api/xhs/sites/${editingSite.value.id}`, {
      site_name: editForm.value.site_name,
      tags: tags,
      notes: editForm.value.notes
    })
    
    closeEditModal()
    fetchSites()
  } catch (err) {
    console.error('保存失败', err)
    error.value = err?.response?.data?.error || '保存失败，请稍后重试'
  }
}

// 关闭编辑弹窗
const closeEditModal = () => {
  editingSite.value = null
  editForm.value = {
    site_name: '',
    tagsText: '',
    notes: ''
  }
}

// 删除站点
const deleteSite = async (siteId) => {
  if (!confirm('确定要删除这个站点吗？')) return
  
  try {
    await axios.delete(`http://localhost:3001/api/xhs/sites/${siteId}`)
    fetchSites()
  } catch (err) {
    console.error('删除失败', err)
    error.value = err?.response?.data?.error || '删除失败，请稍后重试'
  }
}

// 处理图片加载错误
const handleImageError = (event) => {
  event.target.style.display = 'none'
}

// 组件挂载时获取站点列表
onMounted(() => {
  fetchSites()
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

