import re

for path in ['/opt/splitter-test/docker-compose.test.yml', '/opt/splitter/docker-compose.prod.yml']:
    with open(path) as f:
        lines = f.readlines()

    fixed = []
    for line in lines:
        stripped = line.strip()
        # Fix any healthcheck test line that has unquoted ${...} in a flow sequence
        if stripped.startswith('test: [') and '${' in stripped:
            # Extract the CMD-SHELL or CMD type
            if 'CMD-SHELL' in stripped:
                # Format: test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
                fixed.append('      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]\n')
            elif 'redis-cli' in stripped:
                # Format: test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
                fixed.append('      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]\n')
            else:
                fixed.append(line)
        else:
            fixed.append(line)

    with open(path, 'w') as f:
        f.writelines(fixed)
    print(f'Fixed {path}')
