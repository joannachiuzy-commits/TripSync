import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// Vite配置文件，用于构建Vue3应用
export default defineConfig({
  plugins: [vue()], // 使用Vue插件
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src') // 配置路径别名，方便导入
    }
  },
  server: {
    port: 3000, // 前端开发服务器端口
    proxy: {
      '/api': {
        target: 'http://localhost:3008', // 代理到后端服务器
        changeOrigin: true
      }
    }
  }
})


