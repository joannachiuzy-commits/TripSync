import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import GuideList from '../views/GuideList.vue'

// 定义路由配置
const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/guides',
    name: 'GuideList',
    component: GuideList
  }
]

// 创建路由实例
const router = createRouter({
  history: createWebHistory(), // 使用HTML5历史模式
  routes
})

export default router


