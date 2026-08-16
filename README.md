# dsh-remote-workspace

让 DeepSeek Harness WebUI 支持**局域网/远程访问**，并把「添加工作区 → 选择文件夹」从单一原生弹窗升级为**三选一对话框**（原生弹窗 / Web 文件管理器 / SSHFS 挂载远程文件夹）的完整方案。

> ⚠️ **运行环境**：本项目在 **Ubuntu 24.04+/26.04（systemd user 服务 + KDE）上开发并测试通过**。
> **未在 Windows / macOS 上测试**（远程目录浏览走 OpenSSH sftp 协议，理论上跨平台，但仅验证过 Linux 本机 + Windows OpenSSH 远程）。

---

## 功能

- **密码反代**：`dsh-proxy`（aiohttp）把只回环监听的 harness WebUI（`127.0.0.1:3080`）暴露到 `0.0.0.0:6677`，带密码登录表单 + 7 天免登录 cookie（HMAC 无状态签名）。
- **反代兼容层**：剥离 Origin/Referer（CSRF）、注入 `crypto.randomUUID` polyfill（非 localhost 的 HTTP 页面缺它）、SSE / WebSocket 双向转发（默认压缩协商，避免 `zlib wbits=8` 崩溃）。
- **三选一工作区选择**（插件 `dsh-workspace-picker-plus`，走 harness 官方插件路线，零源码侵入）：
  - 本地访问（`localhost` / `127.*` / `[::1]`）→ 原生 OS 文件夹选择器
  - 远程访问 → 全屏居中模态框三选一：
    1. **原生浏览器弹窗**（需远程桌面操作本机）
    2. **Web 文件管理器**（当前页面浏览本机文件系统，支持新建/重命名/删除文件夹）
    3. **SSHFS 挂载远程文件夹**（表单含已保存 SSH 配置下拉 + 挂载点/远程路径目录选择器，挂载后直接采纳为工作区）
- **/api-fs 文件系统 API**（反代内置，认证后可用）：本机目录浏览/新建/重命名/删除、sshfs 挂载/卸载、sftp 远程目录浏览/新建/重命名/删除。

## 架构

```
远程浏览器 ── HTTP/WS ──> dsh-proxy (0.0.0.0:6677, aiohttp)
                              │ 密码认证 + HMAC cookie + Origin 剥离 + polyfill
                              ├─ 反代 ──────> dsh-web (127.0.0.1:3080, harness WebUI)
                              │                  └─ 插件 dsh-workspace-picker-plus
                              │                     （directoryFlow slot 替换，三选一 UI）
                              └─ /api-fs/* ──> 本机文件系统 / sshfs / sftp（远程操作）
```

## 目录结构

```
dsh-remote-workspace/
├── proxy/
│   ├── dsh_proxy.py          # 反代主脚本（密码从环境变量读取）
│   └── dsh-proxy.service     # systemd user 服务模板
├── plugin/                   # dsh-workspace-picker-plus 插件
│   ├── src/client/           #   PickerFlow / FileBrowser / RemoteBrowser / SshfsForm
│   ├── tests/                #   36 个单元测试（vitest）
│   ├── lib/                  #   构建产物（可直接使用）
│   └── package.json / tsdown.config.ts / vitest.config.ts …
└── config/
    ├── cordis.patch.yml      # profile 组合配置（directoryFlow 替换）
    └── apply-ui-settings-fix.py  # 修复反代下插件配置为空（可选补丁）
```

## 安装（Ubuntu）

### 0. 前置依赖

```bash
sudo apt install python3-aiohttp sshfs sshpass  # 反代 + sshfs 挂载
# Node 工具链（pnpm）：按 harness 官方文档安装
```

**需要 clone harness 源码仓库**（插件要放进仓库内构建，dsh-web 服务也从这里启动）：

```bash
git clone https://github.com/deepseek-ai/deepseek-harness.git ~/deepseek-harness
cd ~/deepseek-harness && pnpm install
# 按官方文档初始化 dsh profile，并启动 dsh-web（监听 127.0.0.1:3080）
```

### 1. 部署反代 dsh-proxy

```bash
# 把 proxy/ 下的文件放到合适位置
mkdir -p ~/.hermes/scripts && cp proxy/dsh_proxy.py ~/.hermes/scripts/
mkdir -p ~/.config/systemd/user && cp proxy/dsh-proxy.service ~/.config/systemd/user/

# 修改服务文件里的环境变量（重要！）
#   DSH_PROXY_PASSWORD=你的密码
#   DSH_PROXY_TARGET=http://127.0.0.1:3080   # harness WebUI 地址

systemctl --user daemon-reload
systemctl --user enable --now dsh-proxy.service
systemctl --user status dsh-proxy.service
# 浏览器打开 http://<本机IP>:6677/ 应看到密码登录页
```

### 2. 安装工作区插件（官方插件路线，零源码侵入）

```bash
cd <harness 仓库根目录>            # 例如 ~/deepseek-harness
# 2a. 把 plugin/ 拷贝为 scratch-plugin
cp -r <本仓库>/plugin scratch-plugin
# 2b. 构建（需要 harness 仓库的共享 client preset）
cd scratch-plugin
export PATH=<node 目录>/bin:$PATH
pnpm install && pnpm exec tsdown
cd ..
# 2c. 装入 profile（file 协议加入 dependencies）
cd ~/.dsh/profiles/web
pnpm add file:<harness 仓库根目录>/scratch-plugin
# 2d. 应用组合配置（本仓库 config/cordis.patch.yml 的内容写入 cordis.patch.yml）
cp <本仓库>/config/cordis.patch.yml ~/.dsh/profiles/web/cordis.patch.yml
# 2e. 重启 dsh-web
export XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
systemctl --user restart dsh-web.service
```

> **注意**：插件注册 `directoryFlow` slot 时使用 `priority: -200` 以压过其他占用者（如 dsh-remote 插件的 `-100`）——single-kind slot 规则是**最低 priority 渲染**。

### 3. 修补 ui-settings 源码（强烈建议：反代访问下插件配置才不空白）

**这一步会修改 harness 源码**（约一行）：`packages/client/ui-settings/src/client/settings-scope.ts`
里的 `connection.isLoopback ? 'host' : 'memory'` 决定插件配置的存储位置——非 loopback 访问
（如 `http://192.168.1.8:6677/`）会走 memory 模式，不读写文件，导致插件配置页空白。
把它固定为 `'host'` 即可修复。

已含一键脚本（修改源码 → bundle ui-settings 包 → 重启 dsh-web → 健康检查，**幂等**可重复执行）：

```bash
python3 config/apply-ui-settings-fix.py
```

> **说明**：插件本身走官方 scratch-plugin 路线，是**零源码侵入**的；只有这一步是
> harness 源码级修改（一行）。不做的话，远程访问下插件配置页为空，但三选一功能
> 不受影响。**harness 升级后需要重新执行本脚本**（或手动重打这一行）。

## 使用

1. 局域网设备浏览器打开 `http://<本机IP>:6677/`，输入密码登录。
2. 侧边栏「添加工作区」→ 远程访问下弹出三选一：
   - **原生浏览器弹窗**：在本机弹出系统文件夹选择器（需远程桌面）。
   - **Web 文件管理器**：默认打开 `~`，可导航 `/` 根目录、新建/重命名/删除文件夹，点「选择此目录」直接创建为该路径的工作区。
   - **SSHFS 挂载远程文件夹**：
     - 顶部下拉可选择本机所有用户 `~/.ssh/config` 里已保存的 SSH 登录信息（自动填充主机/用户名/密钥，读不了的配置自动跳过）；
     - 「远程路径」旁的「选择」打开 **sftp 远程目录浏览器**（默认跟随 SSH 登录路径，支持新建/重命名/删除）；
     - 「挂载点」旁的「选择」打开本机目录浏览器（默认 `~`）；
     - 「挂载并选择」执行 sshfs 挂载并直接创建为该路径的工作区。

## /api-fs API 参考

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api-fs/list?path=` | GET | 本机目录列表（缺省 `~`） |
| `/api-fs/mkdir` | POST | 本机新建文件夹 `{path}` |
| `/api-fs/rename` | POST | 本机重命名 `{path, newName}` |
| `/api-fs/delete` | POST | 本机删除（仅空目录/文件）`{path}` |
| `/api-fs/sshfs-mount` | POST | sshfs 挂载 `{host, user, auth, remotePath, mountPoint}` |
| `/api-fs/sshfs-unmount` | POST | 卸载 `{mountPoint}` |
| `/api-fs/ssh-configs` | GET | 发现本机所有用户 `~/.ssh/config` 的登录信息 |
| `/api-fs/remote-list` | POST | sftp 远程目录列表 `{host, user, auth, path}` |
| `/api-fs/remote-pwd` | POST | 远程 SSH 登录路径 |
| `/api-fs/remote-mkdir / remote-rename / remote-delete` | POST | 远程文件夹操作（sftp） |

`auth` 对象：`{type: 'password', password}` 或 `{type: 'key', keyPath}`。

## 配置项（dsh-proxy 环境变量）

| 变量 | 默认 | 说明 |
|------|------|------|
| `DSH_PROXY_HOST` | `0.0.0.0` | 监听地址 |
| `DSH_PROXY_PORT` | `6677` | 监听端口 |
| `DSH_PROXY_PASSWORD` | `changeme` | **访问密码（务必修改）** |
| `DSH_PROXY_TARGET` | `http://127.0.0.1:3080` | 上游 harness WebUI |

## 故障排查

- **插件三选一没出现**：确认 profile `cordis.patch.yml` 生效（`dsh-workspace-picker-plus` 在 `settings.describe` 里）；确认插件 priority（-200）压过其他 directoryFlow 占用者。
- **SSHFS 挂载失败**：本机需 `sshfs` + `sshpass`（密码认证）；挂载点需存在或可创建；远程 Windows OpenSSH 的路径用 `/D:/xxx` 或 `/C:/xxx` 格式。
- **远程目录为空**：sftp 路径需要 POSIX 风格（`C:/Users/x` → `/C:/Users/x`），反代已自动转换。
- **插件配置页空白（反代访问）**：跑 `config/apply-ui-settings-fix.py`。
- **WS 连接 1006**：多为旧 cookie 失效，重新登录即可（cookie 7 天有效）。
- **`zlib does not support wbits=8`**：使用默认 `WebSocketResponse()`（不手动设 `compress=True`），反代已按此实现。

## 安全说明

- 反代是明文 HTTP（非 TLS）。**局域网**使用建议配合 VPN/WireGuard；**公网**暴露务必前置 TLS（Caddy/Nginx）或改用 SSH 隧道。
- 密码只存在于 systemd 服务文件环境变量中，脚本不落盘明文。
- `/api-fs` 端点全部需要登录 cookie 认证。
- sshfs 挂载 / 文件操作以运行 dsh-proxy 的系统用户权限执行。

## License

MIT
