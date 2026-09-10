#!/bin/bash
# ========== 数据库备份脚本 ==========
# 用法: backup-db.sh
# 备份测试和生产数据库，保留最近14天
set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/splitter-backup/db"
mkdir -p "$BACKUP_DIR"

echo "Starting database backup at $(date)"

for DB in splitter_test splitter_prod; do
  FILE="$BACKUP_DIR/${DB}_${DATE}.sql.gz"
  echo "  Backing up $DB -> $FILE"

  # 通过 docker exec 执行 pg_dump
  docker exec splitter_test-postgres-1 \
    pg_dump -U postgres "$DB" 2>/dev/null | gzip > "$FILE"

  if [ -s "$FILE" ]; then
    echo "  OK: $(ls -lh "$FILE" | awk '{print $5}')"
  else
    echo "  WARN: Backup file is empty!"
  fi
done

# 清理14天前的旧备份
echo "Cleaning old backups (older than 14 days)..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +14 -delete

echo "Backup complete."
