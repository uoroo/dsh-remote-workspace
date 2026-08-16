#!/usr/bin/env python3
"""一键重打 deepseek-harness 反代插件配置补丁（修复反代访问时插件配置为空）。

问题背景：ui-settings 的 settings-scope.ts 里，插件配置的存储位置按
`connection.isLoopback ? 'host' : 'memory'` 决定——非 loopback（如 192.168.1.8:6677）
访问时走 memory 模式，配置不读文件导致插件配置页空白。把三元固定为 'host'
即可让反代场景也读写 host 配置文件。

幂等：源码里已无 isLoopback 三元时跳过替换，直接 bundle + 重启。
"""
import os
import pathlib
import subprocess
import sys
import time
import urllib.request

REPO = pathlib.Path.home() / "deepseek-harness"
TARGET = REPO / "packages/client/ui-settings/src/client/settings-scope.ts"
OLD = "connection.isLoopback ? 'host' : 'memory',"
NEW = "'host',  // dsh-remote-workspace 补丁：反代场景固定 host 模式"
PNPM = pathlib.Path.home() / ".hermes/node/bin/pnpm"


def sh(cmd, cwd=None, env=None):
    print(f"\n$ {' '.join(map(str, cmd))}")
    r = subprocess.run(cmd, cwd=cwd, env=env)
    if r.returncode != 0:
        print(f"!! 命令失败 exit={r.returncode}")
        sys.exit(r.returncode)
    return r


def main():
    if not TARGET.exists():
        sys.exit(f"!! 找不到 {TARGET}")
    text = TARGET.read_text(encoding="utf-8")
    if OLD not in text:
        print("✓ 补丁已应用（源码里已无 isLoopback 三元），跳过替换")
    else:
        TARGET.write_text(text.replace(OLD, NEW, 1), encoding="utf-8")
        print("✓ 已替换 settings-scope.ts")

    env = dict(os.environ)
    env["PATH"] = f"{PNPM.parent}:{env.get('PATH', '')}"
    sh([str(PNPM), "--filter", "@deepseek-ai/dsh-client-ui-settings", "bundle"],
       cwd=REPO, env=env)

    env["XDG_RUNTIME_DIR"] = "/run/user/1000"
    env["DBUS_SESSION_BUS_ADDRESS"] = "unix:path=/run/user/1000/bus"
    sh(["systemctl", "--user", "restart", "dsh-web.service"], env=env)

    time.sleep(3)
    try:
        with urllib.request.urlopen("http://127.0.0.1:3080/", timeout=5) as r:
            print(f"\n✓ dsh-web 已重启，3080 HTTP {r.status}")
    except Exception as e:  # noqa: BLE001
        print(f"!! 健康检查失败: {e}")


if __name__ == "__main__":
    main()
