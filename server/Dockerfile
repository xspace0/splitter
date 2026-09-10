# ========== 构建阶段 ==========
# 用 node:20-alpine 作为基础镜像，体积比完整版小很多
FROM node:20-alpine AS build

WORKDIR /app

# 先只拷贝 package*.json，利用 Docker 缓存层
# 只要依赖没变，npm ci 就会命中缓存，不重新下载
COPY package*.json ./
RUN npm ci

# 拷贝源码
COPY . .

# 生成 Prisma Client + 编译 TypeScript
RUN npx prisma generate && npm run build

# ========== 运行阶段 ==========
# 重新用一个干净的 node 镜像，不包含构建工具
FROM node:20-alpine

WORKDIR /app

# tini 解决 PID 1 进程信号问题（Node.js 直接跑在 PID 1 会无法收到 SIGTERM）
RUN apk add --no-cache tini curl

ENV NODE_ENV=production

# 只拷贝生产依赖
COPY package*.json ./
RUN npm ci --omit=dev

# 从构建阶段拷贝编译产物
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]

# 启动时先执行数据库迁移，再启动应用
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
