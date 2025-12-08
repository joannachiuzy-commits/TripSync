<template>
  <div class="home">
    <!-- 欢迎横幅 -->
    <div class="bg-gradient-to-r from-primary-500 to-primary-700 rounded-lg shadow-lg p-12 text-white mb-8">
      <h1 class="text-4xl font-bold mb-4">欢迎来到 TripSync</h1>
      <p class="text-xl opacity-90">发现世界，分享你的旅行故事</p>
    </div>

    <!-- 功能卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
        <div class="text-4xl mb-4">🗺️</div>
        <h3 class="text-xl font-semibold mb-2">探索攻略</h3>
        <p class="text-gray-600">浏览丰富的旅游攻略，发现新的目的地</p>
      </div>
      <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
        <div class="text-4xl mb-4">✍️</div>
        <h3 class="text-xl font-semibold mb-2">分享经验</h3>
        <p class="text-gray-600">记录你的旅行经历，帮助其他旅行者</p>
      </div>
      <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
        <div class="text-4xl mb-4">⭐</div>
        <h3 class="text-xl font-semibold mb-2">收藏喜欢</h3>
        <p class="text-gray-600">收藏你感兴趣的攻略，随时查看</p>
      </div>
    </div>

    <!-- 快速导航 -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-2xl font-bold mb-4">开始探索</h2>
      <router-link
        to="/guides"
        class="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium"
      >
        查看所有攻略 →
      </router-link>
    </div>
  </div>
</template>

<script setup>
// 首页组件，展示应用的主要功能和快速导航
</script>

<style scoped>
.home {
  /* 首页特定样式 */
}
</style>


