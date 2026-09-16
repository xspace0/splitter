#!/bin/bash
echo "=== 健康检查 ==="
curl -s http://localhost:3001/api/health
echo ""

echo "=== 登录 ==="
LOGIN_RESP=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"admin","password":"admin123"}')
echo "$LOGIN_RESP" | head -c 200
echo ""

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
echo "Token: ${TOKEN:0:20}..."

echo "=== 用户列表 ==="
curl -s http://localhost:3001/api/users \
  -H "Authorization: Bearer $TOKEN"
echo ""

echo "=== 创建测试用户 ==="
curl -s -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"username":"测试用户","account":"testuser","password":"test123456","roleType":"VIEWER"}'
echo ""

echo "=== 再次查询列表 ==="
curl -s http://localhost:3001/api/users \
  -H "Authorization: Bearer $TOKEN"
echo ""

echo "=== 无Token访问(应401) ==="
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/users
echo ""
