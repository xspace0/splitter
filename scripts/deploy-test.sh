#!/bin/bash
# ========== 测试环境部署脚本 ==========
# 用法: deploy-test.sh <commit-sha>
# 被 GitHub Actions 的 deploy-test.yml 通过 SSH 调用
set -euo pipefail

SHA=${1:?用法: deploy-test.sh <commit-sha>}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

ENV_NAME="test"
ENV_FILE=".env.test"
COMPOSE_FILE="docker-compose.test.yml"
BACKEND_PORT=3001

echo "=========================================="
echo "  Deploying test environment"
echo "  SHA: $SHA"
echo "  Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# 文件锁：防止并发部署
LOCK_FILE=/var/lock/splitter-deploy-test.lock
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "ERROR: Another deployment is running, abort."
  exit 1
fi

# 记录当前版本（用于回滚）
CURRENT_SHA=$(grep -E '^BACKEND_SHA=' "$ENV_FILE" | cut -d= -f2 || echo "latest")
echo "Current version: $CURRENT_SHA"

# 更新 .env 中的镜像版本
sed -i "s|^BACKEND_SHA=.*|BACKEND_SHA=${SHA}|" "$ENV_FILE"
sed -i "s|^FRONTEND_SHA=.*|FRONTEND_SHA=${SHA}|" "$ENV_FILE"

# 检查哪些镜像存在，只部署可用的服务
SERVICES=""
if docker manifest inspect "ghcr.io/xspace0/splitter-backend:${SHA}" >/dev/null 2>&1; then
  echo "Backend image found, including backend"
  SERVICES="$SERVICES backend"
else
  echo "WARNING: Backend image not found, skipping backend"
fi
if docker manifest inspect "ghcr.io/xspace0/splitter-frontend:${SHA}" >/dev/null 2>&1; then
  echo "Frontend image found, including frontend"
  SERVICES="$SERVICES frontend"
else
  echo "WARNING: Frontend image not found, skipping frontend"
fi

# 拉取新镜像
echo "Pulling images..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull postgres redis $SERVICES

# 重启容器
echo "Starting containers..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres redis $SERVICES

# 健康检查（最多等 60 秒）— 仅当后端部署时检查
if echo "$SERVICES" | grep -q backend; then
  echo "Health check..."
  HEALTHY=0
  for i in 1 2 3 4 5 6; do
    sleep 10
    if curl -fs "http://localhost:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
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
else
  echo "Skipping health check (backend not deployed)"
fi

# 记录成功版本
echo "$SHA" > ".last-good-sha-test"
echo "SUCCESS: Test environment deployed."

# 清理旧镜像
docker image prune -f >/dev/null 2>&1 || true
