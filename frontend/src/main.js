import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

// 创建Vue应用实例并挂载到DOM
const app = createApp(App)

// 使用路由插件
app.use(router)

// 挂载到id为app的元素上
app.mount('#app')


