#!/bin/bash
TOKEN=$(curl -s "https://ghcr.io/token?scope=repository:xspace0/splitter-backend:pull" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
if [ -z "$TOKEN" ]; then
  echo "ERROR: No token returned - package might not exist or is private"
  exit 1
fi
echo "Token obtained, checking tags..."
curl -s "https://ghcr.io/v2/xspace0/splitter-backend/tags/list" -H "Authorization: Bearer $TOKEN"
