#!/bin/bash
set -euo pipefail

# Re-upload all scripts to server using base64 encoding
SCRIPTS_DIR="/d/dev/splitter/scripts"
KEY_PATH="$TEMP/gh_deploy_key"
SERVER="root@1.92.79.114"

for script in deploy-test.sh deploy-prod.sh rollback.sh smoke-test.sh backup-db.sh; do
    echo "Uploading $script..."
    CONTENT=$(cat "$SCRIPTS_DIR/$script" | base64 -w0)
    ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no "$SERVER" "echo $CONTENT | base64 -d > /opt/splitter/scripts/$script && chmod +x /opt/splitter/scripts/$script && cp /opt/splitter/scripts/$script /opt/splitter-test/scripts/$script && chmod +x /opt/splitter-test/scripts/$script && echo OK"
done
