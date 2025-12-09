import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import GuideList from '../views/GuideList.vue'
import TripEditor from '../views/TripEditor.vue'
import SiteLibrary from '../views/SiteLibrary.vue'
import TripManagement from '../views/TripManagement.vue'
import TripEdit from '../views/TripEdit.vue'

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
  },
  {
    path: '/editor',
    name: 'TripEditor',
    component: TripEditor
  },
  {
    path: '/sites',
    name: 'SiteLibrary',
    component: SiteLibrary
  },
  {
    path: '/trips',
    name: 'TripManagement',
    component: TripManagement
  },
  {
    path: '/trips/:id/edit',
    name: 'TripEdit',
    component: TripEdit
  }
]

// 创建路由实例
const router = createRouter({
  history: createWebHistory(), // 使用HTML5历史模式
  routes
})

export default router


