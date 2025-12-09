<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <!-- 导航栏 -->
    <nav class="bg-white shadow-md">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <h1 class="text-2xl font-bold text-primary-600">TripSync</h1>
          </div>
          <div class="flex space-x-4">
            <router-link
              to="/"
              class="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
              active-class="text-primary-600"
            >
              首页
            </router-link>
            <router-link
              to="/guides"
              class="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
              active-class="text-primary-600"
            >
              攻略列表
            </router-link>
            <router-link
              to="/sites"
              class="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
              active-class="text-primary-600"
            >
              第三方攻略库
            </router-link>
            <router-link
              to="/editor"
              class="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
              active-class="text-primary-600"
            >
              解析链接
            </router-link>
            <router-link
              to="/trips"
              class="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
              active-class="text-primary-600"
            >
              行程管理
            </router-link>
          </div>
        </div>
      </div>
    </nav>

    <!-- 主要内容区域 -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <router-view />
    </main>
  </div>
</template>

<script setup>
// App.vue是应用的根组件，包含导航栏和路由视图
</script>


