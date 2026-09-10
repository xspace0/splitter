#!/bin/bash
# ========== 生产环境部署脚本 ==========
# 用法: deploy-prod.sh <commit-sha>
# 被 GitHub Actions 的 deploy.yml 通过 SSH 调用
set -euo pipefail

SHA=${1:?用法: deploy-prod.sh <commit-sha>}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

ENV_NAME="prod"
ENV_FILE=".env.prod"
COMPOSE_FILE="docker-compose.prod.yml"
BACKEND_PORT=3002

echo "=========================================="
echo "  Deploying PRODUCTION environment"
echo "  SHA: $SHA"
echo "  Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# 文件锁
LOCK_FILE=/var/lock/splitter-deploy-prod.lock
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "ERROR: Another deployment is running, abort."
  exit 1
fi

# 记录当前版本
CURRENT_SHA=$(grep -E '^BACKEND_SHA=' "$ENV_FILE" | cut -d= -f2 || echo "latest")
echo "Current version: $CURRENT_SHA"

# 更新 .env 中的镜像版本
sed -i "s|^BACKEND_SHA=.*|BACKEND_SHA=${SHA}|" "$ENV_FILE"
sed -i "s|^FRONTEND_SHA=.*|FRONTEND_SHA=${SHA}|" "$ENV_FILE"

# 拉取新镜像
echo "Pulling images..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull

# 重启容器
echo "Starting containers..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# 健康检查（最多等 60 秒）
echo "Health check..."
HEALTHY=0
for i in 1 2 3 4 5 6; do
  sleep 10
  if curl -fs "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; then
    HEALTHY=1
    echo "Health check passed!"
    break
  fi
  echo "  Attempt $i/6: not ready yet..."
done

if [ "$HEALTHY" -ne 1 ]; then
  echo "ERROR: Health check failed, rolling back to $CURRENT_SHA"
  "$SCRIPT_DIR/rollback.sh" "$ENV_NAME" "$CURRENT_SHA" || true
  exit 1
fi

# 记录成功版本
echo "$SHA" > ".last-good-sha-prod"
echo "SUCCESS: Production environment deployed."

# 清理旧镜像
docker image prune -f >/dev/null 2>&1 || true
