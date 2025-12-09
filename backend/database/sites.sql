-- 小红书站点库表
-- 在Supabase SQL编辑器中执行此脚本创建站点库表

-- 创建站点库表
CREATE TABLE IF NOT EXISTS xhs_sites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_name VARCHAR(255) NOT NULL,
  xhs_url TEXT NOT NULL,
  content TEXT,
  images TEXT[],
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加表注释（PostgreSQL语法）
COMMENT ON TABLE xhs_sites IS '小红书站点库表';
COMMENT ON COLUMN xhs_sites.site_name IS '站点名称';
COMMENT ON COLUMN xhs_sites.xhs_url IS '小红书原链接';
COMMENT ON COLUMN xhs_sites.content IS '解析的正文';
COMMENT ON COLUMN xhs_sites.images IS '图片链接数组';
COMMENT ON COLUMN xhs_sites.tags IS '标签数组，如["美食","东京"]';
COMMENT ON COLUMN xhs_sites.notes IS '备注';

-- 创建索引：用于搜索
CREATE INDEX IF NOT EXISTS idx_xhs_sites_tags ON xhs_sites USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_xhs_sites_name ON xhs_sites(site_name);
CREATE INDEX IF NOT EXISTS idx_xhs_sites_created_at ON xhs_sites(created_at DESC);

-- 启用Row Level Security（行级安全）
ALTER TABLE xhs_sites ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许所有人读取站点
CREATE POLICY "允许所有人读取站点" ON xhs_sites
  FOR SELECT USING (true);

-- 创建策略：允许所有人创建站点
CREATE POLICY "允许所有人创建站点" ON xhs_sites
  FOR INSERT WITH CHECK (true);

-- 创建策略：允许所有人更新站点
CREATE POLICY "允许所有人更新站点" ON xhs_sites
  FOR UPDATE USING (true);

-- 创建策略：允许所有人删除站点
CREATE POLICY "允许所有人删除站点" ON xhs_sites
  FOR DELETE USING (true);

-- 创建更新时间触发器（自动更新updated_at字段）
CREATE TRIGGER update_xhs_sites_updated_at BEFORE UPDATE ON xhs_sites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

