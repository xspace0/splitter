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

# 载入环境变量（供 SQL 初始化等步骤使用 POSTGRES_DB 等配置）
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "./$ENV_FILE"
  set +a
fi

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

# 检查哪些镜像已在本地加载（镜像由 GitHub Actions runner 传输，非服务器直接拉取）
SERVICES=""
if docker images -q "ghcr.io/xspace0/splitter-backend:${SHA}" | grep -q .; then
  echo "Backend image found locally, including backend-test"
  SERVICES="$SERVICES backend-test"
  BACKEND_DEPLOYED=1
else
  echo "WARNING: Backend image not found locally, skipping backend-test"
  BACKEND_DEPLOYED=0
fi
if docker images -q "ghcr.io/xspace0/splitter-frontend:${SHA}" | grep -q .; then
  echo "Frontend image found locally, including frontend-test"
  SERVICES="$SERVICES frontend-test"
else
  echo "WARNING: Frontend image not found locally, skipping frontend-test"
fi

# 仅拉取基础服务镜像（postgres/redis 从 Docker Hub 镜像源拉取）
echo "Pulling base images (postgres, redis)..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull postgres redis

# 重启容器
echo "Starting containers..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres redis $SERVICES

# 应用初始数据与数据库层约束（幂等，可重复执行）
# 这些 SQL 无法由 prisma db push 表达：部分唯一索引、静态字典表预置、孤儿引用修复
if [ "$BACKEND_DEPLOYED" = "1" ]; then
  echo "Applying seed/constraint SQL..."
  PG_CONTAINER="$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q postgres)"
  if [ -n "$PG_CONTAINER" ]; then
    for sql_file in prisma/sql/seed-region.sql prisma/sql/partial-unique-indexes.sql; do
      if [ -f "$sql_file" ]; then
        echo "  -> $sql_file"
        docker exec -i "$PG_CONTAINER" psql -U postgres -d "${POSTGRES_DB:-splitter_test}" -v ON_ERROR_STOP=1 \
          < "$sql_file" >/dev/null || echo "     WARNING: $sql_file 执行失败（不影响启动）"
      else
        echo "  -> 跳过（不存在）：$sql_file"
      fi
    done
  else
    echo "  WARNING: 未找到 postgres 容器，跳过 SQL 初始化"
  fi
fi

# 健康检查（最多等 60 秒）— 仅当后端部署时检查
if [ "$BACKEND_DEPLOYED" = "1" ]; then
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
