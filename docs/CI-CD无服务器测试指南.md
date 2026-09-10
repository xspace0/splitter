# CI/CD 无服务器测试指南

## 一、概述

没有服务器也能完整测试 CI/CD 流程。核心思路：

| 阶段          | 是否需要服务器 | 测试方式                             |
| ----------- | ------- | -------------------------------- |
| CI 代码检查     | ❌ 不需要   | GitHub Actions 免费\_runner 自动执行   |
| CD 构建验证     | ❌ 不需要   | GitHub Actions 构建 Docker 镜像（不推送） |
| Docker 本地测试 | ❌ 不需要   | 本地 Docker Desktop 启动数据库+应用       |
| 服务器部署       | ✅ 需要    | 购买服务器后配置 Secrets 即可自动启用          |

## 二、测试方式一览

```
┌─────────────────────────────────────────────────────┐
│                   无服务器测试方案                     │
├─────────────┬───────────────────────────────────────┤
│  方式一      │  推送代码 → GitHub Actions 自动跑 CI    │
│  GitHub     │  → 代码检查 + 类型检查 + 结构验证        │
│  Actions    │  → Docker 镜像构建测试（不推送）         │
│             │  → 全程免费，无需服务器                  │
├─────────────┼───────────────────────────────────────┤
│  方式二      │  本地安装 Docker Desktop               │
│  本地        │  → docker compose 启动 PostgreSQL+Redis│
│  Docker     │  → docker build 验证 Dockerfile        │
│             │  → 模拟完整部署环境                     │
├─────────────┼───────────────────────────────────────┤
│  方式三      │  使用 GitHub Actions 手动触发          │
│  手动触发    │  → workflow_dispatch 选择 test 环境    │
│  CD 流程    │  → 验证构建+打包流程                    │
│             │  → 部署步骤自动跳过                     │
└─────────────┴───────────────────────────────────────┘
```

## 三、方式一：GitHub Actions CI 测试（推荐）

### 3.1 前提条件

- 代码已推送到 GitHub 仓库

- 无需任何服务器或额外配置

### 3.2 触发 CI 流程

```bash
# 方式 A：提交到 main/develop 分支自动触发
git push origin main

# 方式 B：创建 PR 自动触发
git checkout -b feature/test-ci
git push origin feature/test-ci
# 然后在 GitHub 上创建 Pull Request
```

### 3.3 查看结果

1. 打开 GitHub 仓库页面
2. 点击 **Actions** 标签
3. 查看最近的 workflow 运行状态

CI 会执行以下检查：

- ✅ ESLint 代码规范检查

- ✅ Prettier 格式检查

- ✅ TypeScript 类型检查

- ✅ 项目结构完整性验证

### 3.4 手动触发 CI

在 GitHub 仓库 → Actions → "CI - 代码检查与测试" → 点击 **Run workflow** 按钮。

## 四、方式二：CD 构建验证测试

### 4.1 手动触发 CD

项目有两个独立的 CD 工作流，分别对应测试环境和生产环境：

1. **测试环境**：GitHub 仓库 → Actions → "CD - 测试环境部署" → 点击 **Run workflow**
2. **生产环境**：GitHub 仓库 → Actions → "CD - 生产环境部署" → 点击 **Run workflow**

注意：两个工作流都没有环境选择参数，它们是独立的文件（`deploy-test.yml` 和 `deploy.yml`）。

### 4.2 CD 执行内容

```
后端构建阶段：
  ├── 登录阿里云镜像仓库
  ├── docker build（context: ./server）
  └── 推送镜像（tag: test 或 latest）

前端构建阶段：
  └── 当前为占位（PC 管理后台尚未创建）

部署阶段（需要配置 Secrets）：
  ├── SCP 传输部署文件到服务器
  ├── SSH 执行 deploy.sh
  └── 健康检查

部署阶段（未配置 Secrets 时）：
  └── ❌ SSH 步骤失败（需要配置服务器密钥）
```

### 4.3 查看构建产物

1. 点击对应的 workflow 运行记录
2. 页面底部 **Artifacts** 区域可下载构建产物
3. 测试环境 artifact 保留 7 天，生产环境保留 30 天

## 五、方式三：本地 Docker 测试

### 5.1 安装 Docker Desktop

```powershell
# Windows 下载安装 Docker Desktop
# 官网：https://www.docker.com/products/docker-desktop/

# 验证安装
docker --version
docker compose version
```

### 5.2 启动本地测试环境

```powershell
# 仅启动数据库（PostgreSQL + Redis）
docker compose -f docker-compose.test.yml up -d

# 查看容器状态
docker compose -f docker-compose.test.yml ps

# 查看日志
docker compose -f docker-compose.test.yml logs -f
```

### 5.3 完整构建测试（含应用镜像）

```powershell
# 启动全部服务（含应用构建）
docker compose -f docker-compose.test.yml --profile full up -d --build

# 验证应用是否启动
curl http://localhost:13000/health

# 停止并清理
docker compose -f docker-compose.test.yml down

# 清理数据卷（彻底重置）
docker compose -f docker-compose.test.yml down -v
```

### 5.4 本地测试数据库连接

```powershell
# 连接 PostgreSQL（端口 15432）
docker exec -it splitter-test-pg psql -U splitter_test -d splitter_test_db

# 连接 Redis（端口 16379）
docker exec -it splitter-test-redis redis-cli
```

### 5.5 单独验证 Dockerfile

```powershell
# 构建 Docker 镜像（Dockerfile 在 server/ 目录下）
docker build -t splitter-test:local -f server/Dockerfile server/

# 查看镜像大小
docker images splitter-test:local

# 运行容器测试
docker run --rm -p 13000:3000 splitter-test:local
```

## 六、本地模拟完整 CI/CD 流程

### 6.1 一键测试脚本

```powershell
# 在项目根目录执行
Write-Host "1/5 安装依赖..." -ForegroundColor Cyan
npm install

Write-Host "2/5 ESLint 检查..." -ForegroundColor Cyan
npm run lint

Write-Host "3/5 Prettier 格式检查..." -ForegroundColor Cyan
npm run format:check

Write-Host "4/5 TypeScript 类型检查..." -ForegroundColor Cyan
npm run type:check

Write-Host "5/5 项目结构验证..." -ForegroundColor Cyan
npm run test:ci

Write-Host ""
Write-Host "✅ 本地 CI 检查全部通过" -ForegroundColor Green
```

### 6.2 完整验证命令

```powershell
# 一键执行全部 CI 检查
npm run verify
```

## 七、购买服务器后的切换步骤

当购买服务器后，只需配置 GitHub Secrets 即可自动启用部署：

### 7.1 配置 Secrets

GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret：

**生产环境 Secrets：**

| Secret 名称        | 值                                    | 说明       |
| ---------------- | ------------------------------------ | -------- |
| ALIYUN\_REGISTRY | `registry.cn-hangzhou.aliyuncs.com`   | 镜像仓库地址   |
| ALIYUN\_REGISTRY\_USERNAME | 用户名                        | 镜像仓库用户名  |
| ALIYUN\_REGISTRY\_PASSWORD | 密码                        | 镜像仓库密码   |
| DEPLOY\_HOST     | `123.45.67.89`                       | 服务器 IP   |
| DEPLOY\_USER     | `root` 或 `ubuntu`                    | SSH 用户名  |
| DEPLOY\_SSH\_KEY | `-----BEGIN RSA PRIVATE KEY-----...` | SSH 私钥内容 |
| DEPLOY\_DOMAIN   | `splitter.example.com`               | 生产域名     |
| PROD\_DB\_PASSWORD | 数据库密码                           | 生产数据库密码  |
| PROD\_REDIS\_PASSWORD | Redis 密码                       | 生产 Redis 密码 |
| PROD\_JWT\_SECRET | JWT 签名密钥                          | 生产 JWT 密钥 |
| PROD\_ENCRYPT\_KEY | 身份证加密密钥                       | 生产加密密钥   |

**测试环境 Secrets：**

| Secret 名称        | 值                                    | 说明       |
| ---------------- | ------------------------------------ | -------- |
| TEST\_DEPLOY\_HOST | `123.45.67.89`                     | 服务器 IP（同生产） |
| TEST\_DEPLOY\_USER | `root` 或 `ubuntu`                  | SSH 用户名  |
| TEST\_DEPLOY\_SSH\_KEY | SSH 私钥内容                     | SSH 私钥   |
| TEST\_DEPLOY\_DOMAIN | `test.splitter.example.com`      | 测试域名     |
| TEST\_DB\_PASSWORD | 测试数据库密码                        | 测试数据库密码  |
| TEST\_REDIS\_PASSWORD | 测试 Redis 密码                   | 测试 Redis 密码 |
| TEST\_JWT\_SECRET | 测试 JWT 密钥                        | 测试 JWT 密钥 |
| TEST\_ENCRYPT\_KEY | 测试加密密钥                         | 测试加密密钥   |

### 7.2 触发部署

1. **测试环境**：push 到 develop 分支自动触发，或 Actions → "CD - 测试环境部署" → Run workflow
2. **生产环境**：push 到 main 分支自动触发，或 Actions → "CD - 生产环境部署" → Run workflow

部署步骤会自动执行：

- 构建并推送 Docker 镜像
- SCP 传输部署文件到服务器
- SSH 执行部署脚本（deploy.sh）
- 健康检查验证

## 八、CI/CD 流程图

```
代码推送 / PR
     │
     ▼
┌─────────────┐     ┌──────────────────────────┐
│  CI 流程    │────▶│  代码检查 + 类型检查 + 测试  │
│  (自动触发)  │     │  (GitHub 免费 Runner)     │
└─────────────┘     └────────────┬─────────────┘
                                 │
                          检查通过？
                          ├ 是 ──▶ 继续
                          └ 否 ──▶ ❌ 阻止合并
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │  CD 构建验证              │
                    │  Docker 镜像构建测试       │
                    │  构建产物上传              │
                    └────────────┬─────────────┘
                                 │
                        是否配置了部署密钥？
                        ├ 是 ──▶ 部署到服务器
                        └ 否 ──▶ ⏭️ 跳过部署（当前状态）
                                 │
                                 ▼
                        ✅ 流程完成
```

## 九、常见问题

### Q1: GitHub Actions 免费额度够用吗？

- 公开仓库：完全免费，无限制

- 私有仓库：每月 2000 分钟免费额度（个人账户）

- 单次 CI 运行约 2-3 分钟，足够日常使用

### Q2: 不推送到 GitHub 能测试 CI 吗？

可以，使用本地验证命令：

```powershell
npm run verify
```

这与 CI 执行的检查完全一致。

### Q3: Docker Desktop 占用资源太多？

可以只启动数据库不构建应用：

```powershell
docker compose -f docker-compose.test.yml up -d postgres redis
```

### Q4: 什么时候需要买服务器？

- 小程序上线需要后端 API 时

- 需要正式域名和 HTTPS 证书时

- 需要多人协作访问时

- 之前可以用 GitHub Actions + 本地 Docker 完成所有开发测试

## 十、测试检查清单

- [ ] 代码推送后 CI 自动执行

- [ ] CI 中 ESLint 检查通过

- [ ] CI 中 Prettier 检查通过

- [ ] CI 中 TypeScript 类型检查通过

- [ ] CI 中项目结构验证通过

- [ ] CD 手动触发 test 模式构建成功

- [ ] Docker 镜像本地构建成功

- [ ] 本地 PostgreSQL + Redis 正常启动

- [ ] 本地数据库可正常连接

- [ ] `npm run verify` 本地一键通过

