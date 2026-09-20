-- ============================================================
-- 应用层约束的数据库兜底脚本
-- ============================================================
-- 背景：文档《数据库设计》3.4 要求「同一社区有效状态下只能分配一个操作员」，
--       依赖部分唯一索引 uk_community_active (community_id) WHERE status=1 AND is_deleted=0。
--       Prisma schema 语法无法表达带 WHERE 的部分索引，因此以 SQL 形式维护。
--
-- 执行方式（生产/测试统一走 prisma migrate deploy，本文件作为迁移的补充）：
--   psql "$DATABASE_URL" -f prisma/sql/partial-unique-indexes.sql
--
-- 幂等：使用 IF NOT EXISTS，可重复执行。
-- ============================================================

-- 社区-用户关联：一个社区的有效归属只能有一个操作员
CREATE UNIQUE INDEX IF NOT EXISTS uk_community_active
  ON sys_user_community (community_id)
  WHERE status = 1 AND is_deleted = 0;

-- 说明：社区名称与分光器名称的唯一性约束存在文档歧义——
--   《数据库设计》2.3/5.3 描述为「未删除状态下唯一」（需社区内/全局的 WHERE is_deleted=0 唯一索引），
--   而现有 Prisma schema 中仅命名为 uk_* 的普通索引（非唯一）。
--   本脚本暂不创建，待明确「全局唯一」还是「社区内唯一」后再补：
--   CREATE UNIQUE INDEX IF NOT EXISTS uk_community_name_active
--     ON community (community_name) WHERE is_deleted = 0;
--   CREATE UNIQUE INDEX IF NOT EXISTS uk_splitter_name_active
--     ON optical_splitter (community_id, splitter_name) WHERE is_deleted = 0;
