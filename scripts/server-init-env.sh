#!/bin/bash
set -euo pipefail

PG_PASS_TEST=$(openssl rand -hex 16)
REDIS_PASS_TEST=$(openssl rand -hex 16)
JWT_SECRET_TEST=$(openssl rand -hex 32)
PG_PASS_PROD=$(openssl rand -hex 16)
REDIS_PASS_PROD=$(openssl rand -hex 16)
JWT_SECRET_PROD=$(openssl rand -hex 32)

cat > /opt/splitter-test/.env.test << ENDOFFILE
COMPOSE_PROJECT_NAME=splitter_test
ENV=test
BACKEND_PORT=3001
BACKEND_IMAGE=ghcr.io/xspace0/splitter-backend
BACKEND_SHA=latest
DATABASE_URL=postgresql://postgres:${PG_PASS_TEST}@postgres:5432/splitter_test?schema=public
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${PG_PASS_TEST}
POSTGRES_DB=splitter_test
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=${REDIS_PASS_TEST}
JWT_SECRET=${JWT_SECRET_TEST}
JWT_EXPIRES_IN=7d
FRONTEND_PORT=8081
FRONTEND_IMAGE=ghcr.io/xspace0/splitter-frontend
FRONTEND_SHA=latest
API_BASE_URL=http://1.92.79.114:3001
ENDOFFILE

cat > /opt/splitter/.env.prod << ENDOFFILE
COMPOSE_PROJECT_NAME=splitter_prod
ENV=production
BACKEND_PORT=3002
BACKEND_IMAGE=ghcr.io/xspace0/splitter-backend
BACKEND_SHA=latest
DATABASE_URL=postgresql://postgres:${PG_PASS_PROD}@postgres:5432/splitter_prod?schema=public
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${PG_PASS_PROD}
POSTGRES_DB=splitter_prod
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=1
REDIS_PASSWORD=${REDIS_PASS_PROD}
JWT_SECRET=${JWT_SECRET_PROD}
JWT_EXPIRES_IN=7d
FRONTEND_PORT=8082
FRONTEND_IMAGE=ghcr.io/xspace0/splitter-frontend
FRONTEND_SHA=latest
API_BASE_URL=http://1.92.79.114:3002
ENDOFFILE

chmod 600 /opt/splitter-test/.env.test /opt/splitter/.env.prod
echo "=== .env files created ==="
ls -la /opt/splitter-test/.env.test /opt/splitter/.env.prod
echo ""
echo "=== Key preview (first 8 chars) ==="
echo "TEST  PG_PASS: ${PG_PASS_TEST:0:8}..."
echo "TEST  REDIS:   ${REDIS_PASS_TEST:0:8}..."
echo "TEST  JWT:     ${JWT_SECRET_TEST:0:8}..."
echo "PROD  PG_PASS: ${PG_PASS_PROD:0:8}..."
echo "PROD  REDIS:   ${REDIS_PASS_PROD:0:8}..."
echo "PROD  JWT:     ${JWT_SECRET_PROD:0:8}..."
