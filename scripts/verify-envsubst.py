#!/usr/bin/env python3
"""
精确复刻 envsubst 的替换语义，用于本地校验 nginx.conf.template 渲染结果。
envsubst 的关键行为：只替换命令行 `SHELL-FORMAT` 中显式列出的变量，其余
`$var` / `${var}` 原样保留（这正是我们保护 nginx 自身 $host/$uri 的方式）。
"""
import re
import sys

SHELL_VAR = re.compile(r'\$(\w+)|\$\{(\w+)\}')


def envsubst(text: str, allowed: set, env: dict) -> str:
    out = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch == '$':
            # 处理 $$ 转义
            if i + 1 < n and text[i + 1] == '$':
                out.append('$')
                i += 2
                continue
            m = SHELL_VAR.match(text, i)
            if m:
                name = m.group(1) or m.group(2)
                if name in allowed:
                    out.append(env.get(name, ''))
                    i = m.end()
                    continue
                # 不在白名单：原样保留
                out.append(m.group(0))
                i = m.end()
                continue
        out.append(ch)
        i += 1
    return ''.join(out)


def main():
    template_path, allowed_csv = sys.argv[1], sys.argv[2]
    allowed = set(allowed_csv.split(','))

    with open(template_path, encoding='utf-8') as f:
        template = f.read()

    cases = {
        'defaults(test)': {'API_UPSTREAM': 'http://backend-test:3000'},
        'prod': {'API_UPSTREAM': 'http://backend-prod:3000'},
        'unset (fallback applied by shell)': {'API_UPSTREAM': 'http://backend-test:3000'},
    }

    failures = 0
    for label, env in cases.items():
        rendered = envsubst(template, allowed, env)
        print(f'--- {label} ---')
        for line in rendered.splitlines():
            if 'proxy_pass' in line:
                print('   ', line.strip())
        # 断言：nginx 自身变量必须原样保留
        for must_keep in ['$host', '$remote_addr', '$proxy_add_x_forwarded_for', '$uri', '$scheme']:
            if must_keep not in rendered:
                print(f'    FAIL: nginx variable {must_keep} was destroyed')
                failures += 1
        # 断言：模板占位符必须已被替换
        if '${API_UPSTREAM}' in rendered:
            print('    FAIL: ${API_UPSTREAM} left unreplaced')
            failures += 1
        # 断言：无残留的 ${...}
        leftovers = set(re.findall(r'\$\{[A-Za-z_]\w*\}', rendered))
        if leftovers:
            print(f'    FAIL: leftover placeholders {leftovers}')
            failures += 1
        else:
            print('    OK: no leftover placeholders, nginx vars intact')

    # 校验 config.template.js 渲染
    with open('web/public/config.template.js', encoding='utf-8') as f:
        cfg_tpl = f.read()
    for value in ['/api', 'http://example:3001']:
        rendered = envsubst(cfg_tpl, {'API_BASE_URL'}, {'API_BASE_URL': value})
        print(f'--- config.template.js with API_BASE_URL={value} ---')
        print('   ', rendered.strip())

    print()
    print('RESULT:', 'ALL CHECKS PASSED' if failures == 0 else f'{failures} CHECK(S) FAILED')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
