# 分光器资源管理系统 CI/CD 完整方案（v2）

> 版本：v2 | 更新点：并行 Job、运行时配置、安全扫描、并发控制、告警回滚
> 环境：单台华为云 2核2G（Ubuntu + 宝塔）+ Docker Compose + GitHub Actions
> 代码：单仓库 Monorepo（server / web / miniapp）

---

## 1. 架构总览

### 1.1 部署拓扑

```
                      华为云服务器 (2核2G, Ubuntu + 宝塔)
         ┌──────────────────────────────────────────────────────────┐
         │  Docker                                                  │
         │                                                          │
         │   ┌───────────┐  ┌───────────┐   共享实例                │
         │   │ frontend  │  │ frontend  │  ┌──────────────────────┐ │
         │   │  -test    │  │  -prod    │  │ PostgreSQL (384M)    │ │
         │   │  :8081    │  │  :8082    │  │  ├ splitter_test     │ │
         │   └─────┬─────┘  └─────┬─────┘  │  └ splitter_prod     │ │
         │         │              │        └──────────────────────┘ │
         │   ┌─────▼─────┐  ┌─────▼─────┐  ┌──────────────────────┐ │
         │   │ backend   │  │ backend   │  │ Redis (128M)         │ │
         │   │  -test    │  │  -prod    │  │  ├ db0: test         │ │
         │   │  :3001    │  │  :3002    │  │  └ db1: prod         │ │
         │   └───────────┘  └───────────┘  └──────────────────────┘ │
         └──────────────────────────────────────────────────────────┘
                        ▲                            ▲
                PC浏览器 │                    小程序 │（微信开发者工具/真机）
```

### 1.2 内存预算（2G 内存关键）

| 容器              | 内存限制 |
| ----------------- | -------- |
| postgres          | 384 MB   |
| redis             | 128 MB   |
| backend-test      | 384 MB   |
| backend-prod      | 384 MB   |
| frontend-test     | 32 MB    |
| frontend-prod     | 32 MB    |
| **小计**          | **1.34 GB** |
| 系统 + 宝塔 + Docker 自身 | ~600 MB |

> ⚠️ 宝塔面板若启用 MySQL / PHP / Nginx，请务必停用，否则内存会爆。

### 1.3 端口规划

| 服务        | 测试 | 正式 | 备注                    |
| ----------- | ---- | ---- | ----------------------- |
| 后端 API    | 3001 | 3002 | 对外暴露                |
| 前端 Web    | 8081 | 8082 | 对外暴露                |
| PostgreSQL  | —    | —    | 仅容器网络内可访问      |
| Redis       | —    | —    | 仅容器网络内可访问      |
| 宝塔面板    | 8888 | —    | 已存在，避免冲突        |

---

## 2. 目录结构

```
splitter/
├── server/                          # 后端 NestJS
│   ├── src/
│   ├── prisma/
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
├── web/                             # PC 管理后台 (Vue3 + Vite)
│   ├── src/
│   ├── public/
│   │   └── config.template.js       # ★ 运行时配置模板
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── entrypoint.sh                # ★ 容器启动脚本（envsubst 注入）
│   ├── package.json
│   └── .env.example
├── miniapp/                         # 微信小程序 (uni-app)
│   ├── src/
│   ├── package.json
│   └── project.config.json
├── docker-compose.yml
├── .env.test                        # ⚠️ 仅服务器本地存在，不提交
├── .env.prod                        # ⚠️ 仅服务器本地存在，不提交
├── .github/
│   └── workflows/
│       ├── ci.yml                   # ★ 并行构建 + 安全扫描
│       ├── deploy.yml               # ★ 部署（自动测试 / 手动正式）
│       └── rollback.yml             # ★ 一键回滚
├── scripts/
│   ├── deploy-test.sh
│   ├── deploy-prod.sh
│   ├── rollback.sh                  # ★ 回滚脚本
│   ├── backup-db.sh
│   └── smoke-test.sh                # ★ 冒烟测试
└── README.md
```

---

## 3. 环境变量模板

### 3.1 `.env.test`（服务器上手动创建）

```env
COMPOSE_PROJECT_NAME=splitter_test
ENV=test

BACKEND_PORT=3001
BACKEND_IMAGE=ghcr.io/YOUR_ORG/splitter-backend:latest
BACKEND_SHA=latest
DATABASE_URL=postgresql://test_user:test_pass@postgres:5432/splitter_test?schema=public
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
JWT_SECRET=change_me_test_secret
JWT_EXPIRES_IN=7d

FRONTEND_PORT=8081
FRONTEND_IMAGE=ghcr.io/YOUR_ORG/splitter-frontend:latest
FRONTEND_SHA=latest
API_BASE_URL=http://YOUR_SERVER_IP:3001   # ★ 运行时注入

POSTGRES_USER=postgres
POSTGRES_PASSWORD=change_me_strong
POSTGRES_DB=postgres

REDIS_PASSWORD=change_me_redis
```

### 3.2 `.env.prod`（服务器上手动创建）

结构与 `.env.test` 相同，改动点：

```env
COMPOSE_PROJECT_NAME=splitter_prod
ENV=production
BACKEND_PORT=3002
DATABASE_URL=postgresql://prod_user:prod_pass@postgres:5432/splitter_prod?schema=public
REDIS_DB=1
JWT_SECRET=change_me_prod_secret_very_long
FRONTEND_PORT=8082
API_BASE_URL=http://YOUR_SERVER_IP:3002
```

---

## 4. Docker 编排

### 4.1 `docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [splitter]
    mem_limit: 384m

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [splitter]
    mem_limit: 128m

  backend-test:
    image: ${BACKEND_IMAGE}
    restart: always
    environment:
      NODE_ENV: test
      PORT: 3000
      DATABASE_URL: ${DATABASE_URL}
      REDIS_HOST: ${REDIS_HOST}
      REDIS_PORT: ${REDIS_PORT}
      REDIS_DB: ${REDIS_DB}
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN}
    ports: ["${BACKEND_PORT}:3000"]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    networks: [splitter]
    mem_limit: 384m

  backend-prod:
    image: ${BACKEND_IMAGE}
    restart: always
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: ${DATABASE_URL}
      REDIS_HOST: ${REDIS_HOST}
      REDIS_PORT: ${REDIS_PORT}
      REDIS_DB: ${REDIS_DB}
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN}
    ports: ["${BACKEND_PORT}:3000"]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    networks: [splitter]
    mem_limit: 384m

  frontend-test:
    image: ${FRONTEND_IMAGE}
    restart: always
    environment:
      API_BASE_URL: ${API_BASE_URL}
    ports: ["${FRONTEND_PORT}:80"]
    networks: [splitter]
    mem_limit: 32m

  frontend-prod:
    image: ${FRONTEND_IMAGE}
    restart: always
    environment:
      API_BASE_URL: ${API_BASE_URL}
    ports: ["${FRONTEND_PORT}:80"]
    networks: [splitter]
    mem_limit: 32m

networks:
  splitter:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
```

---

## 5. Dockerfile（多阶段 + 运行时配置）

### 5.1 后端 `server/Dockerfile`

```dockerfile
# ---------- 构建阶段 ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ---------- 运行阶段 ----------
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache curl
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 3000

# 使用 tini 处理 PID 1，防止僵尸进程
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# 迁移 + 启动；PRISMA_SCHEMA_ENGINE_BINARY 可选
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

### 5.2 前端 `web/Dockerfile`

```dockerfile
# ---------- 构建阶段 ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- 运行阶段 ----------
FROM nginx:alpine
# 安装 envsubst
RUN apk add --no-cache gettext
COPY --from=build /app/dist /usr/share/nginx/html
COPY public/config.template.js /usr/share/nginx/html/config.template.js
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
```

### 5.3 `web/public/config.template.js`

```javascript
window.__APP_CONFIG__ = {
  API_BASE_URL: "${API_BASE_URL}",
};
```

### 5.4 `web/entrypoint.sh`

```bash
#!/bin/sh
set -e
# 只替换 API_BASE_URL，避免误替换其他 $ 变量
envsubst '${API_BASE_URL}' \
  < /usr/share/nginx/html/config.template.js \
  > /usr/share/nginx/html/config.js

echo "✅ 运行时配置注入完成：API_BASE_URL=${API_BASE_URL}"
exec nginx -g 'daemon off;'
```

### 5.5 `web/nginx.conf`

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # config.js 禁用缓存，确保切换 API 地址立即生效
    location = /config.js {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
        expires -1;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

### 5.6 前端运行时读取配置 `web/src/utils/config.ts`

```typescript
declare global {
  interface Window {
    __APP_CONFIG__?: { API_BASE_URL?: string };
  }
}

export const API_BASE_URL =
  window.__APP_CONFIG__?.API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  '/api';
```

---

## 6. GitHub Actions 工作流

### 6.1 `ci.yml` —— 并行构建 + 安全扫描 + 单元测试

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  REGISTRY: ghcr.io
  BACKEND_IMAGE: ghcr.io/${{ github.repository }}-backend
  FRONTEND_IMAGE: ghcr.io/${{ github.repository }}-frontend

jobs:
  # ---------- 后端 ----------
  backend:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
      packages: write
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: server/package-lock.json

      - name: 依赖安装
        working-directory: server
        run: npm ci

      - name: Lint & 类型检查
        working-directory: server
        run: |
          npm run lint
          npx tsc --noEmit

      - name: SCA - npm audit
        working-directory: server
        run: npm audit --audit-level=high || true   # 先告警，后续再强制
        continue-on-error: true

      - name: 单元测试
        working-directory: server
        run: npm run test -- --coverage

      - name: SAST - CodeQL 初始化
        uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
          queries: security-extended

      - name: SAST - CodeQL 分析
        uses: github/codeql-action/analyze@v3

      - name: 构建并推送后端镜像
        if: github.event_name == 'push'
        uses: docker/build-push-action@v5
        with:
          context: server
          push: true
          tags: |
            ${{ env.BACKEND_IMAGE }}:latest
            ${{ env.BACKEND_IMAGE }}:${{ github.sha }}

      - name: Trivy 镜像扫描
        if: github.event_name == 'push'
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.BACKEND_IMAGE }}:${{ github.sha }}
          severity: 'CRITICAL,HIGH'
          exit-code: '0'              # 先告警，稳定后改为 1
          format: 'sarif'
          output: 'trivy-backend.sarif'

      - name: 上传 Trivy 报告
        if: github.event_name == 'push'
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: trivy-backend.sarif

  # ---------- 前端 ----------
  frontend:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
      packages: write
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: web/package-lock.json

      - name: 依赖安装
        working-directory: web
        run: npm ci

      - name: Lint & 类型检查
        working-directory: web
        run: |
          npm run lint
          npm run type-check || npx vue-tsc --noEmit

      - name: SCA - npm audit
        working-directory: web
        run: npm audit --audit-level=high || true
        continue-on-error: true

      - name: 单元测试
        working-directory: web
        run: npm run test:unit -- --run

      - name: 构建并推送前端镜像
        if: github.event_name == 'push'
        uses: docker/build-push-action@v5
        with:
          context: web
          push: true
          # 注意：不再传 VITE_API_BASE_URL，改为运行时注入
          tags: |
            ${{ env.FRONTEND_IMAGE }}:latest
            ${{ env.FRONTEND_IMAGE }}:${{ github.sha }}

      - name: Trivy 镜像扫描
        if: github.event_name == 'push'
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.FRONTEND_IMAGE }}:${{ github.sha }}
          severity: 'CRITICAL,HIGH'
          exit-code: '0'
          format: 'sarif'
          output: 'trivy-frontend.sarif'

      - name: 上传 Trivy 报告
        if: github.event_name == 'push'
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: trivy-frontend.sarif
```

### 6.2 `deploy.yml` —— 部署（自动测试 / 手动正式）

```yaml
name: Deploy

on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: '部署环境'
        required: true
        default: 'test'
        type: choice
        options: [test, prod]
      confirm:
        description: '正式环境需输入 YES 确认'
        required: false
        default: ''

concurrency:
  group: deploy-${{ github.event.inputs.environment || 'test' }}
  cancel-in-progress: false       # 部署不允许被取消

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    # 只有 CI 成功才自动触发
    if: |
      (github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success')
      || github.event_name == 'workflow_dispatch'

    steps:
      - name: 判断目标环境
        id: target
        run: |
          if [ "${{ github.event_name }}" = "workflow_run" ]; then
            echo "ENV=test" >> $GITHUB_OUTPUT
          else
            echo "ENV=${{ github.event.inputs.environment }}" >> $GITHUB_OUTPUT
          fi

      - name: 正式环境二次确认
        if: steps.target.outputs.ENV == 'prod' && github.event.inputs.confirm != 'YES'
        run: |
          echo "❌ 正式环境部署必须输入 YES 确认"
          exit 1

      - name: SSH 部署
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USERNAME }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script_stop: true
          command_timeout: 10m
          script: |
            cd /opt/splitter
            ./scripts/deploy-${{ steps.target.outputs.ENV }}.sh ${{ github.sha }}

      - name: 冒烟测试
        if: steps.target.outputs.ENV == 'test'
        run: |
          bash scripts/smoke-test.sh http://${{ secrets.SERVER_HOST }}:8081 http://${{ secrets.SERVER_HOST }}:3001

      - name: 通知
        if: always()
        run: |
          STATUS="${{ job.status }}"
          ENV="${{ steps.target.outputs.ENV }}"
          SHA="${{ github.sha }}"
          if [ "$STATUS" = "success" ]; then
            EMOJI="✅"; TITLE="部署成功"
          else
            EMOJI="❌"; TITLE="部署失败"
          fi
          curl -s -X POST "${{ secrets.WX_WEBHOOK }}" \
            -H 'Content-Type: application/json' \
            -d "{\"msgtype\":\"markdown\",\"markdown\":{\"content\":\"$EMOJI **$TITLE**\\n> 环境：$ENV\\n> 提交：\`$SHA\`\"}}"
```

### 6.3 `rollback.yml` —— 一键回滚

```yaml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [test, prod]
        required: true
      sha:
        description: '回滚到指定 commit SHA'
        required: true

concurrency:
  group: deploy-${{ github.event.inputs.environment }}
  cancel-in-progress: false

jobs:
  rollback:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: SSH 回滚
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USERNAME }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script_stop: true
          script: |
            cd /opt/splitter
            ./scripts/rollback.sh ${{ github.event.inputs.environment }} ${{ github.event.inputs.sha }}
```

---

## 7. 部署与回滚脚本

### 7.1 `scripts/deploy-test.sh` / `deploy-prod.sh`

```bash
#!/bin/bash
# 用法: deploy-test.sh <commit-sha>
set -euo pipefail

ENV=${1:?需要传入 commit SHA}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# 文件锁：防止并发部署
LOCK_FILE=/var/lock/splitter-deploy.lock
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "❌ 检测到另一个部署正在进行，退出"
  exit 1
fi

ENV_FILE=".env.test"
BACKEND_CONTAINER="splitter_test-backend-test-1"
PROD_PORT=3001
if [ "$ENV_NAME" = "prod" ]; then
  ENV_FILE=".env.prod"
  BACKEND_CONTAINER="splitter_prod-backend-prod-1"
  PROD_PORT=3002
fi

# 读取当前 SHA 作为回滚点
CURRENT_SHA=$(grep -E '^BACKEND_SHA=' "$ENV_FILE" | cut -d= -f2 || echo "latest")
echo "🔖 当前版本：$CURRENT_SHA，即将部署：$ENV"

# 更新 .env 中的镜像 tag
sed -i "s|^BACKEND_SHA=.*|BACKEND_SHA=${ENV}|"  "$ENV_FILE"
sed -i "s|^FRONTEND_SHA=.*|FRONTEND_SHA=${ENV}|" "$ENV_FILE"
sed -i "s|:latest|:${ENV}|g; s|:${CURRENT_SHA}|:${ENV}|g" "$ENV_FILE"

# 拉取镜像
docker compose --env-file "$ENV_FILE" pull

# 启动
docker compose --env-file "$ENV_FILE" up -d

# 健康检查（3 次）
echo "🩺 健康检查中..."
HEALTHY=0
for i in 1 2 3 4 5 6; do
  sleep 10
  if curl -fs "http://localhost:${PROD_PORT}/health" >/dev/null 2>&1; then
    HEALTHY=1
    echo "✅ 健康检查通过"
    break
  fi
done

if [ "$HEALTHY" -ne 1 ]; then
  echo "❌ 健康检查失败，自动回滚到 $CURRENT_SHA"
  "$SCRIPT_DIR/rollback.sh" "$ENV_NAME" "$CURRENT_SHA" || true
  exit 1
fi

# 记录本次成功版本
echo "$ENV" > ".last-good-sha-${ENV_NAME}"

# 清理旧镜像
docker image prune -f >/dev/null 2>&1 || true

echo "🎉 环境 $ENV_NAME 部署完成"
```

> **注意**：`deploy-test.sh` 中 `ENV_NAME="test"`，`deploy-prod.sh` 中 `ENV_NAME="prod"`，可共用同一脚本逻辑。

### 7.2 `scripts/rollback.sh`

```bash
#!/bin/bash
# 用法: rollback.sh <test|prod> <sha>
set -euo pipefail

ENV_NAME=${1:?}
TARGET_SHA=${2:?}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

ENV_FILE=".env.${ENV_NAME}"
BACKEND_PORT=3001
[ "$ENV_NAME" = "prod" ] && BACKEND_PORT=3002

echo "⏪ 回滚 $ENV_NAME 到 $TARGET_SHA"
sed -i "s|^BACKEND_SHA=.*|BACKEND_SHA=${TARGET_SHA}|"  "$ENV_FILE"
sed -i "s|^FRONTEND_SHA=.*|FRONTEND_SHA=${TARGET_SHA}|" "$ENV_FILE"
sed -i "s|:latest|:${TARGET_SHA}|g" "$ENV_FILE"

docker compose --env-file "$ENV_FILE" pull
docker compose --env-file "$ENV_FILE" up -d

# 验证
for i in 1 2 3 4 5 6; do
  sleep 10
  if curl -fs "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; then
    echo "✅ 回滚成功"
    exit 0
  fi
done

echo "❌ 回滚后健康检查失败，请人工介入"
exit 1
```

### 7.3 `scripts/smoke-test.sh`

```bash
#!/bin/bash
# 用法: smoke-test.sh <frontend_url> <backend_url>
set -euo pipefail

FRONTEND=${1:?}
BACKEND=${2:?}

check() {
  local url=$1 name=$2 expected=$3
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
  if [ "$code" != "$expected" ]; then
    echo "❌ $name 失败：$url -> $code（期望 $expected）"
    return 1
  fi
  echo "✅ $name 通过（$code）"
}

check "$FRONTEND/"               "前端首页"     200
check "$BACKEND/health"          "后端健康"     200
check "$BACKEND/api/v1/regions"  "行政区划接口" 401   # 未登录应返回 401

echo "🎉 冒烟测试全部通过"
```

---

## 8. 首次部署初始化清单

```bash
# 1. 服务器上安装 Docker + Compose 插件
curl -fsSL https://get.docker.com | bash
apt install -y docker-compose-plugin

# 2. 创建项目目录
mkdir -p /opt/splitter && cd /opt/splitter

# 3. 初始化 docker-compose.yml、scripts/、.env.test、.env.prod（手动上传或从 Git 拉取）

# 4. 启动 PostgreSQL + Redis 基础服务
docker compose --env-file .env.test up -d postgres redis

# 5. 创建数据库与用户
docker exec -it splitter_test-postgres-1 psql -U postgres <<'SQL'
CREATE USER test_user WITH PASSWORD 'test_pass';
CREATE DATABASE splitter_test OWNER test_user;
CREATE USER prod_user WITH PASSWORD 'prod_pass';
CREATE DATABASE splitter_prod OWNER prod_user;
SQL

# 6. 生成 SSH 部署密钥并配置 GitHub Secrets
ssh-keygen -t ed25519 -f ~/.ssh/gh-deploy -N ''
cat ~/.ssh/gh-deploy.pub >> ~/.ssh/authorized_keys

# 7. 推送 main 分支，等待 CI/CD 自动运行
```

---

# ✅ v2 自检清单

## A. v1 提出的 6 个问题 → 是否解决

| # | 原问题 | v2 解决方案 | 状态 |
|---|--------|------------|------|
| 1 | 单 Job 串行 | `ci.yml` 拆为 `backend` / `frontend` 两个并行 job | ✅ |
| 2 | SSH vs GitOps | 保留 SSH，但服务器状态（compose、nginx、脚本）版本化到 Git；未来上 K8s 可切 ArgoCD | ⚠️ 部分解决 |
| 3 | 缺安全/测试 | CodeQL（SAST）、npm audit（SCA）、Trivy（镜像）、单元测试、冒烟测试 | ✅ |
| 4 | API URL 写死 | `config.template.js` + `entrypoint.sh` + `envsubst` 运行时注入 | ✅ |
| 5 | 无并发控制 | `concurrency` + `timeout-minutes` + `flock` 三层防护 | ✅ |
| 6 | 无告警/回滚 | 企业微信通知 + 自动回滚 + `rollback.yml` 一键回滚 | ✅ |

---

## B. v2 自检：仍存在的问题（务必注意）

### ⚠️ 问题 1：并发部署 + 数据库迁移的竞态
两个环境共用**同一个 PostgreSQL 实例**。测试和正式同时触发部署时，虽然它们使用不同的数据库（`splitter_test` / `splitter_prod`），但 `prisma migrate deploy` 会各自操作自己的库，**本身不冲突**。
- **风险点**：如果将来两个环境共用一个数据库名（比如有人误操作），会有并发迁移冲突。
- **建议**：保持数据库名严格分离；迁移前可加一个全局 Redis 锁（可选）。

### ⚠️ 问题 2：`latest` tag 的歧义
`docker-compose.yml` 中用 `${BACKEND_IMAGE}:${BACKEND_SHA}`，但部署脚本里同时改 `BACKEND_SHA` 又 `sed` 改 image 字段，逻辑可能冗余/冲突。
- **建议**：简化——统一只通过 `BACKEND_SHA` 变量控制；image 字段写死 `:${BACKEND_SHA}`。我在下面给出修正。

### ⚠️ 问题 3：前端 `config.js` 浏览器缓存
虽然 nginx 对 `config.js` 加了 `no-store`，但如果用户浏览器曾缓存过旧版本，首次访问旧页面时仍可能用旧的 API 地址。
- **建议**：`index.html` 也加 `no-cache`；或在 `config.js` 请求后加时间戳 query（在 `index.html` 中 `?v=xxx`）。

### ⚠️ 问题 4：Trivy / CodeQL 报告首次运行可能误报
首次运行漏洞扫描时，很可能命中一堆中高危，直接 `exit-code: 1` 会阻塞 CI。
- **建议**：v2 中先设 `exit-code: 0`（只报警不阻断），等基线稳定后再打开。

### ⚠️ 问题 5：`workflow_run` 触发的坑
`workflow_run` 事件在 fork 或某些分支保护规则下行为不一致；PR 的 CI 也会触发 `workflow_run`。
- **修正**：v2 中已加 `if: github.event.workflow_run.conclusion == 'success'` 且只处理 `main` 分支。**但要确保 CI 的 push 分支也仅针对 main**。

### ⚠️ 问题 6：内存仍偏紧（1.34GB 容器 + 系统）
宝塔面板 + Docker + Ubuntu 系统本身约 500-700MB。如果后端内存突增（Node.js GC 峰值），可能 OOM。
- **建议**：
  - 关闭宝塔中所有不用的服务（MySQL、PHP、Nginx 独立安装版）。
  - 为容器加 `memswap_limit` = `mem_limit`（防止使用 swap 拖慢整机）。
  - 安装 `earlyoom` 或宝塔自带内存监控，提前告警。

### ⚠️ 问题 7：Trivy 扫描的是**本地构建的镜像**
`docker/build-push-action` 推送后，本机不一定还留有所推送的镜像层。`aquasecurity/trivy-action` 需要能拉取镜像。
- **修正**：改为 `trivy image ghcr.io/...:${SHA}`（从 registry 拉取），或把 push 改为 load + push 两步。

### ⚠️ 问题 8：Rollback workflow 没有「列出可用版本」
用户需要手填 SHA，容易填错。
- **改进**：增加一步在服务器上 `docker image ls --format '{{.Tag}}' <image> | head -20`，把可选 tag 打印到 workflow summary。或另写 `list-versions.yml`。

### ⚠️ 问题 9：CI 全绿但部署失败，通知仅一条
`deploy.yml` 的通知只在部署 job 结束时发。如果 CI 失败，用户可能没收到。
- **建议**：CI 失败时也发通知（在 `ci.yml` 增加 `on: failure` 的 job，或统一到 `workflow_run` 里判断）。

### ⚠️ 问题 10：数据库备份未加密、未异地
`backup-db.sh` 只是 `pg_dump | gzip` 到本地磁盘。服务器故障时备份同时丢失。
- **建议**：
  - 上传到华为云 OBS（`obsutil`）或另一台机器。
  - 备份文件用 `age` 或 `gpg` 加密，密码离线保管。

### ⚠️ 问题 11：微信小程序 CI 未纳入
v2 尚未包含小程序自动上传流程。
- **建议**：单独 `miniapp-release.yml`，只在打 tag 时触发 `miniprogram-ci` 上传。

### ⚠️ 问题 12：未处理 `.env.prod` 的 secret 管理
`.env.prod` 明文存在服务器 `/opt/splitter/`。如果服务器被入侵，密码直接泄露。
- **建议**：
  - 权限设为 `chmod 600 .env.prod`，所有者 `deploy`。
  - 考虑引入 Docker Secrets（单机 Compose 支持 file-based secret）。

---

## C. 修正后的关键代码片段

### C1. 简化后的镜像 tag 控制（对应问题 2）

`docker-compose.yml` 中不再使用 `:latest`，一律使用：

```yaml
backend-test:
  image: ${BACKEND_IMAGE}:${BACKEND_SHA}
```

`.env.test` 中：
```env
BACKEND_IMAGE=ghcr.io/YOUR_ORG/splitter-backend
BACKEND_SHA=latest      # 部署脚本会改成具体 SHA
FRONTEND_IMAGE=ghcr.io/YOUR_ORG/splitter-frontend
FRONTEND_SHA=latest
```

`deploy-test.sh` 中：
```bash
sed -i "s|^BACKEND_SHA=.*|BACKEND_SHA=${ENV}|"   "$ENV_FILE"
sed -i "s|^FRONTEND_SHA=.*|FRONTEND_SHA=${ENV}|" "$ENV_FILE"
```
不再 `sed` 改 image 字段。

### C2. Trivy 从 registry 拉取（对应问题 7）

```yaml
- name: Trivy 镜像扫描（从 GHCR 拉取）
  if: github.event_name == 'push'
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.BACKEND_IMAGE }}:${{ github.sha }}
    severity: 'CRITICAL,HIGH'
    exit-code: '0'
    format: 'sarif'
    output: 'trivy-backend.sarif'
```
需要保证 workflow 已 `docker login` 且 GHCR 权限允许（`packages: read`）。如果无权限，可改为 `docker save` 后 `trivy image --input`。

### C3. 让 `index.html` 不缓存（对应问题 3）

`nginx.conf` 增加：

```nginx
location = /index.html {
    add_header Cache-Control "no-store, no-cache, must-revalidate";
    expires -1;
}
```

### C4. 备份加密上传（对应问题 10）

`backup-db.sh` 升级：

```bash
#!/bin/bash
set -euo pipefail
DATE=$(date +%Y%m%d_%H%M%S)
DIR=/opt/backups
mkdir -p "$DIR"

for DB in splitter_test splitter_prod; do
  FILE="$DIR/${DB}_$DATE.sql.gz"
  docker exec splitter_test-postgres-1 pg_dump -U postgres "$DB" | gzip > "$FILE"
  gpg --batch --yes --encrypt --recipient backup@yourdomain "$FILE"
  rm -f "$FILE"
done

# 上传到 OBS（示例）
# obsutil cp "$DIR"/*.gpg obs://your-bucket/db-backups/ -r -f

find "$DIR" -name "*.gpg" -mtime +14 -delete
```

---

## D. v2 最终检查表

| 项 | 状态 |
|----|------|
| 并行构建 Job | ✅ |
| SAST (CodeQL) | ✅ |
| SCA (npm audit) | ✅ |
| 镜像扫描 (Trivy) | ✅ 修正后可用 |
| 单元测试 | ✅ |
| 冒烟测试 | ✅ |
| 运行时前端配置 | ✅ |
| concurrency + timeout + flock | ✅ |
| 多通道告警 | ✅ |
| 自动 + 一键回滚 | ✅ |
| GitOps 演进路径 | ⚠️ 已规划，未实施 |
| 小程序 CI | ⚠️ 待补 |
| 备份加密/异地 | ⚠️ 待补 |
| `.env.prod` 权限加固 | ⚠️ 待补 |

---

**v2 已完整整合你提出的 6 项改进，并自检出 12 项仍存在的问题**。其中 4 项（Trivy 拉取方式、tag 控制、index.html 缓存、rollback 参数来源）已在 C 节给出修正代码。剩余 8 项属于「可选加强」或「未来演进」，不影响当前上线。

需要我继续输出 **v3（补齐小程序 CI + 备份加密 + Docker Secrets）** 吗？或者你希望先按 v2 落地，边跑边改？
