# CI/CD 配置指南

## 一、GitHub Secrets 配置

GitHub Actions 需要通过 SSH 连接你的服务器部署，所以需要在仓库里配置 Secrets（加密存储，不会泄露）。

### 配置路径
GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret

### 需要配置的 Secrets

| Secret 名称 | 值 | 说明 |
|---|---|---|
| `SERVER_HOST` | 你的服务器 IP | 如 `123.45.67.89` |
| `SERVER_USERNAME` | SSH 用户名 | 如 `root` 或 `deploy` |
| `SSH_PRIVATE_KEY` | SSH 私钥内容 | 见下方"生成 SSH 密钥" |

### 生成 SSH 密钥

在你的服务器上执行：

```bash
# 1. 生成密钥对（专门给 GitHub Actions 用）
ssh-keygen -t ed25519 -f ~/.ssh/gh-deploy -N ''

# 2. 把公钥加入 authorized_keys
cat ~/.ssh/gh-deploy.pub >> ~/.ssh/authorized_keys

# 3. 查看私钥内容（复制到 GitHub Secrets）
cat ~/.ssh/gh-deploy
```

把 `cat ~/.ssh/gh-deploy` 输出的全部内容（包括 `-----BEGIN OPENSSH PRIVATE KEY-----` 和 `-----END OPENSSH PRIVATE KEY-----`）复制到 GitHub Secret `SSH_PRIVATE_KEY`。

---

## 二、分支保护规则

### main 分支（生产）
GitHub 仓库 → Settings → Branches → Add rule → Branch name pattern: `main`

| 规则 | 值 | 说明 |
|---|---|---|
| Require a pull request before merging | ✅ | 必须 PR 合并，不能直接 push |
| Require approvals | 0 | 个人项目可以设 0，团队建议 1+ |
| Require status checks to pass | ✅ | CI 必须通过才能合并 |
| Require branches to be up to date | ✅ | 合并前必须与 main 同步 |
| Do not allow bypassing the above | ✅ | 管理员也不能绕过 |
| Allow auto-merge | ✅ | 允许自动合并 |
| Automatically delete head branches | ✅ | 合并后自动删除功能分支 |

### develop 分支（测试）
同上，Branch name pattern: `develop`

---

## 三、服务器首次初始化

### 3.1 安装 Docker

```bash
curl -fsSL https://get.docker.com | bash
apt install -y docker-compose-plugin
```

### 3.2 创建目录结构

```bash
# 生产环境目录
mkdir -p /opt/splitter/scripts
mkdir -p /opt/splitter-test/scripts

# 备份目录
mkdir -p /opt/splitter-backup/db
```

### 3.3 上传配置文件

把以下文件上传到对应目录：

**生产环境 `/opt/splitter/`：**
- `docker-compose.prod.yml`
- `scripts/deploy-prod.sh`
- `scripts/rollback.sh`
- `scripts/smoke-test.sh`
- `scripts/backup-db.sh`
- `.env.prod`（手动创建，参考 `.env.prod.example`）

**测试环境 `/opt/splitter-test/`：**
- `docker-compose.test.yml`
- `scripts/deploy-test.sh`
- `scripts/rollback.sh`
- `scripts/smoke-test.sh`
- `.env.test`（手动创建，参考 `.env.test.example`）

### 3.4 创建数据库和用户

```bash
# 启动 PostgreSQL
cd /opt/splitter-test
docker compose -f docker-compose.test.yml --env-file .env.test up -d postgres

# 创建测试库
docker exec -it splitter_test-postgres-1 psql -U postgres <<'SQL'
CREATE USER test_user WITH PASSWORD 'test_pass';
CREATE DATABASE splitter_test OWNER test_user;
SQL

# 创建生产库
docker exec -it splitter_test-postgres-1 psql -U postgres <<'SQL'
CREATE USER prod_user WITH PASSWORD 'prod_pass';
CREATE DATABASE splitter_prod OWNER prod_user;
SQL
```

### 3.5 设置脚本权限

```bash
chmod +x /opt/splitter/scripts/*.sh
chmod +x /opt/splitter-test/scripts/*.sh
chmod 600 /opt/splitter/.env.prod
chmod 600 /opt/splitter-test/.env.test
```

### 3.6 设置定时备份

```bash
# 每天凌晨3点备份
echo "0 3 * * * /opt/splitter/scripts/backup-db.sh >> /var/log/splitter-backup.log 2>&1" | crontab -
```

---

## 四、完整流程图

```
开发者在本地写代码
    │
    ├── 提交到 feature/* 分支
    │      │
    │      └── PR 到 develop 分支
    │             │
    │             ├── CI 自动触发（lint + typecheck + build + push 镜像）
    │             │
    │             └── CI 通过 → 合并到 develop
    │                    │
    │                    └── push 到 develop → Deploy Test 自动触发
    │                           │
    │                           ├── SSH 到服务器，执行 deploy-test.sh
    │                           ├── 拉取镜像 → 重启容器 → 健康检查
    │                           └── 冒烟测试 → 通知
    │
    └── PR develop → main（发布）
           │
           ├── CI 自动触发
           │
           └── CI 通过 → 合并到 main
                  │
                  └── 手动触发 Deploy Prod → 输入 YES 确认
                         │
                         ├── SSH 到服务器，执行 deploy-prod.sh
                         ├── 拉取镜像 → 重启容器 → 健康检查
                         └── 冒烟测试 → 完成
```

---

## 五、日常操作

| 操作 | 命令/步骤 |
|---|---|
| 查看测试环境 | `docker compose -f docker-compose.test.yml ps` |
| 查看测试日志 | `docker logs -f splitter_test-backend-test-1` |
| 回滚测试环境 | GitHub → Actions → Rollback → 选择 test + SHA |
| 回滚生产环境 | GitHub → Actions → Rollback → 选择 prod + SHA |
| 手动部署测试 | GitHub → Actions → Deploy Test → Run workflow |
| 手动部署生产 | GitHub → Actions → Deploy Prod → 输入 YES → Run workflow |
| 查看可用版本 | `docker image ls ghcr.io/xspace0/splitter-backend` |
