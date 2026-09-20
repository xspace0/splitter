-- ============================================================
-- 行政区划 seed 数据（sys_region）
-- ============================================================
-- 背景：sys_region 是静态国标字典表，文档《数据库设计》3.5 要求由后台导入脚本维护。
--       项目此前无任何导入途径，导致该表为空，社区无法绑定区县
--       （实测存在 region_id=0 的孤儿记录），「按区县隔离」的权限规则失效。
--
-- 幂等：使用 ON CONFLICT 保护编码唯一列，可重复执行。
-- 用法：
--   docker exec -i <postgres容器> psql -U postgres -d <库名> < prisma/sql/seed-region.sql
--
-- 说明：这里内置的是项目当前使用地（北京市 → 北京市 → 延庆区）。
--       完整国标全量数据请用 prisma/seed-region.ts 传入 JSON 生成后导入。
-- ============================================================

-- 省
INSERT INTO sys_region (region_name, parent_id, region_level, region_code)
VALUES ('北京市', NULL, 'PROVINCE', '110000')
ON CONFLICT (region_code) DO NOTHING;

-- 市
INSERT INTO sys_region (region_name, parent_id, region_level, region_code)
SELECT '北京市', p.id, 'CITY', '110100'
FROM sys_region p
WHERE p.region_code = '110000'
ON CONFLICT (region_code) DO NOTHING;

-- 区县
INSERT INTO sys_region (region_name, parent_id, region_level, region_code)
SELECT '延庆区', c.id, 'DISTRICT', '110119'
FROM sys_region c
WHERE c.region_code = '110100'
ON CONFLICT (region_code) DO NOTHING;

-- 校验输出
SELECT id, region_name, parent_id, region_level, region_code
FROM sys_region
ORDER BY id;

-- ============================================================
-- 数据修复：把指向不存在行政区划的孤儿 region_id 归位
-- ============================================================
-- 数据库无物理外键，历史数据可能存在 region_id=0 或指向已删除记录的情况。
-- 这里统一归到上面的区县节点，避免列表接口因「必需关系返回 null」而 500。
UPDATE community
SET region_id = (SELECT id FROM sys_region WHERE region_code = '110119')
WHERE region_id IS NULL
   OR NOT EXISTS (SELECT 1 FROM sys_region r WHERE r.id = community.region_id);

UPDATE sys_user
SET region_id = (SELECT id FROM sys_region WHERE region_code = '110119')
WHERE region_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys_region r WHERE r.id = sys_user.region_id);
