#!/bin/bash
# ========== 回滚脚本 ==========
# 用法: rollback.sh <test|prod> <commit-sha>
# 将环境回滚到指定版本的镜像
set -euo pipefail

ENV_NAME=${1:?用法: rollback.sh <test|prod> <sha>}
TARGET_SHA=${2:?用法: rollback.sh <test|prod> <sha>}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

ENV_FILE=".env.${ENV_NAME}"
COMPOSE_FILE="docker-compose.${ENV_NAME}.yml"
BACKEND_PORT=3001
[ "$ENV_NAME" = "prod" ] && BACKEND_PORT=3002

echo "=========================================="
echo "  ROLLBACK: $ENV_NAME -> $TARGET_SHA"
echo "  Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# 更新 .env 中的镜像版本回旧版本
sed -i "s|^BACKEND_SHA=.*|BACKEND_SHA=${TARGET_SHA}|" "$ENV_FILE"
sed -i "s|^FRONTEND_SHA=.*|FRONTEND_SHA=${TARGET_SHA}|" "$ENV_FILE"

# 拉取旧镜像
echo "Pulling images..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull

# 重启容器
echo "Starting containers..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# 验证
echo "Health check..."
for i in 1 2 3 4 5 6; do
  sleep 10
  if curl -fs "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; then
    echo "SUCCESS: Rollback to $TARGET_SHA complete."
    exit 0
  fi
  echo "  Attempt $i/6: not ready yet..."
done

echo "ERROR: Health check failed after rollback. Manual intervention required."
exit 1
