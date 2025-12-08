/**
 * Supabase连接配置示例文件
 * 
 * 使用说明：
 * 1. 复制此文件为 supabase.js
 * 2. 填入你的Supabase项目配置
 * 3. 在server.js中导入使用
 */

import { createClient } from '@supabase/supabase-js'

// Supabase项目配置
const supabaseUrl = 'https://sdsbpwskfxzlbtpvmnvd.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkc2Jwd3NrZnh6bGJ0cHZtbnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjMzOTEsImV4cCI6MjA4MDczOTM5MX0._ZH9StyUrZN8IbJiJ1HC7I4gM1bZ-L4MXSNdcXrsSdY'

// 创建Supabase客户端实例
export const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * 数据库表结构示例（在Supabase SQL编辑器中执行）：
 * 
 * CREATE TABLE guides (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   title VARCHAR(255) NOT NULL,
 *   description TEXT NOT NULL,
 *   location VARCHAR(255) NOT NULL,
 *   content TEXT,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 * 
 * -- 启用Row Level Security（行级安全）
 * ALTER TABLE guides ENABLE ROW LEVEL SECURITY;
 * 
 * -- 创建策略：允许所有人读取
 * CREATE POLICY "允许所有人读取攻略" ON guides
 *   FOR SELECT USING (true);
 * 
 * -- 创建策略：允许所有人插入（可根据需要修改）
 * CREATE POLICY "允许所有人创建攻略" ON guides
 *   FOR INSERT WITH CHECK (true);
 * 
 * -- 创建策略：允许所有人更新（可根据需要修改）
 * CREATE POLICY "允许所有人更新攻略" ON guides
 *   FOR UPDATE USING (true);
 * 
 * -- 创建策略：允许所有人删除（可根据需要修改）
 * CREATE POLICY "允许所有人删除攻略" ON guides
 *   FOR DELETE USING (true);
 */

