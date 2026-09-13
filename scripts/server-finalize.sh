#!/bin/bash
set -euo pipefail

echo "=== 创建生产数据库 ==="
PG_PASS_PROD=$(grep POSTGRES_PASSWORD /opt/splitter/.env.prod | cut -d= -f2)
docker exec splitter_test-postgres-1 psql -U postgres -c "CREATE DATABASE splitter_prod;" 2>&1 || echo "数据库已存在"

echo ""
echo "=== 数据库列表 ==="
docker exec splitter_test-postgres-1 psql -U postgres -c "\l" 2>&1 | grep splitter

echo ""
echo "=== Redis 测试 ==="
REDIS_PASS_TEST=$(grep REDIS_PASSWORD /opt/splitter-test/.env.test | cut -d= -f2)
docker exec splitter_test-redis-1 redis-cli -a "$REDIS_PASS_TEST" ping 2>&1

echo ""
echo "=== 脚本权限 ==="
chmod +x /opt/splitter/scripts/*.sh /opt/splitter-test/scripts/*.sh
ls -la /opt/splitter/scripts/ /opt/splitter-test/scripts/

echo ""
echo "=== 定时备份 ==="
(crontab -l 2>/dev/null | grep -v backup-db; echo "0 3 * * * /opt/splitter/scripts/backup-db.sh >> /var/log/splitter-backup.log 2>&1") | crontab -
crontab -l 2>&1

echo ""
echo "=== 最终状态 ==="
free -h
echo "---"
df -h /
echo "---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>&1
