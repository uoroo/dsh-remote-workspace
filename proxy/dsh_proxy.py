#!/usr/bin/env python3
"""DeepSeek Harness WebUI 密码中转代理。

监听 0.0.0.0:6677，访问时要求输入密码，密码正确后反向代理到
127.0.0.1:3080 的 harness webui。支持 HTTP（含流式/SSE）与 WebSocket 转发。

环境变量（均可省略，用默认值）:
  DSH_PROXY_HOST      监听地址（默认 0.0.0.0）
  DSH_PROXY_PORT      监听端口（默认 6677）
  DSH_PROXY_PASSWORD  访问密码（默认 Sqnhhy327）
  DSH_PROXY_TARGET    上游地址（默认 http://127.0.0.1:3080）
"""
import asyncio
import hmac
import hashlib
import os
import re
import shlex
import time

from aiohttp import web, ClientSession, ClientTimeout, WSMsgType

LISTEN_HOST = os.environ.get("DSH_PROXY_HOST", "0.0.0.0")
LISTEN_PORT = int(os.environ.get("DSH_PROXY_PORT", "6677"))
PASSWORD = os.environ.get("DSH_PROXY_PASSWORD", "changeme")
TARGET = os.environ.get("DSH_PROXY_TARGET", "http://127.0.0.1:3080").rstrip("/")

COOKIE_NAME = "dsh_auth"
SESSION_TTL = 7 * 86400  # 7 天

# 用密码派生的 HMAC secret 做无状态签名 token：服务重启后旧 cookie 依然有效，
# 不再依赖内存 dict（之前重启会清空 session，导致已登录用户的 WS 认证失败）。
_SECRET = hashlib.sha256(("dsh-proxy:" + PASSWORD).encode()).digest()


def _issue_token() -> str:
    exp = str(int(time.time() + SESSION_TTL))
    sig = hmac.new(_SECRET, exp.encode(), hashlib.sha256).hexdigest()
    return f"{exp}.{sig}"


def _authed(request: web.Request) -> bool:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return False
    try:
        exp_str, sig = token.split(".", 1)
        expected = hmac.new(_SECRET, exp_str.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return False
        return time.time() < int(exp_str)
    except (ValueError, IndexError):
        return False

# 转发时需剔除的 hop-by-hop / 由 aiohttp 自动处理的头
# origin/referer 也剔除：上游 harness 有 CSRF Origin 校验，反代后 Origin 会
# 变成中转的 host（如 192.168.1.8:6677）导致 403，剥离后走"无 Origin"分支。
_SKIP_REQ_HEADERS = {
    "host", "connection", "keep-alive", "proxy-authenticate",
    "proxy-authorization", "te", "trailers", "transfer-encoding",
    "upgrade", "content-length", "accept-encoding",
    "origin", "referer",
}
_SKIP_RESP_HEADERS = {
    "connection", "keep-alive", "transfer-encoding", "content-length",
    "content-encoding", "upgrade",
}


def _check_password(pwd: str) -> bool:
    return hmac.compare_digest(pwd or "", PASSWORD)


LOGIN_HTML = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DeepSeek Harness · 登录</title>
<style>
  :root { --bg:#0b0f17; --card:rgba(255,255,255,0.04); --border:rgba(255,255,255,0.1);
          --text:#e6edf3; --dim:#8b949e; --accent:#8b5cf6; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { min-height:100vh; display:flex; align-items:center; justify-content:center;
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
         background:var(--bg); color:var(--text); }
  .card { width:min(360px, 90vw); background:var(--card); border:1px solid var(--border);
          border-radius:18px; padding:36px 28px; text-align:center; }
  .logo { font-size:44px; margin-bottom:12px; }
  h1 { font-size:19px; font-weight:700; margin-bottom:6px; }
  .sub { color:var(--dim); font-size:13px; margin-bottom:26px; }
  input { width:100%; padding:12px 14px; border-radius:10px; border:1px solid var(--border);
          background:rgba(0,0,0,0.3); color:var(--text); font-size:15px; outline:none;
          transition:border-color .15s; margin-bottom:14px; }
  input:focus { border-color:var(--accent); }
  button { width:100%; padding:12px; border:none; border-radius:10px; background:var(--accent);
           color:#fff; font-size:15px; font-weight:600; cursor:pointer; }
  button:hover { filter:brightness(1.1); }
  .err { color:#f87171; font-size:13px; margin-top:14px; display:{ERR_DISPLAY}; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">🤖</div>
    <h1>DeepSeek Harness</h1>
    <div class="sub">请输入访问密码</div>
    <form method="post" action="/login" autocomplete="off">
      <input type="password" name="password" placeholder="密码" autofocus>
      <button type="submit">进入</button>
    </form>
    <div class="err">{ERR_MSG}</div>
  </div>
</body>
</html>"""


# crypto.randomUUID polyfill：非 localhost 的 HTTP 页面（如 192.168.1.8:6677）
# 属于非安全上下文，window.crypto.randomUUID 不存在，前端会报
# "crypto.randomUUID is not a function"。注入此段用 getRandomValues 兜底。
POLYFILL_JS = """(function () {
  var c = window.crypto || (window.crypto = {});
  if (c.randomUUID || !c.getRandomValues) return;
  c.randomUUID = function () {
    var b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = function (i) { return ('0' + b[i].toString(16)).slice(-2); };
    return h(0)+h(1)+h(2)+h(3)+'-'+h(4)+h(5)+'-'+h(6)+h(7)+'-'+h(8)+h(9)+'-'+h(10)+h(11)+h(12)+h(13)+h(14)+h(15);
  };
})();"""


def _inject_polyfill(html: bytes) -> bytes:
    text = html.decode("utf-8", errors="replace")
    tag = "<script>" + POLYFILL_JS + "</script>"
    if "<head>" in text:
        text = text.replace("<head>", "<head>" + tag, 1)
    elif "<html>" in text:
        text = text.replace("<html>", "<html>" + tag, 1)
    else:
        text = tag + text
    return text.encode("utf-8")


def _login_page(err_msg: str = "") -> web.Response:
    html = LOGIN_HTML.replace("{ERR_MSG}", err_msg).replace(
        "{ERR_DISPLAY}", "block" if err_msg else "none"
    )
    return web.Response(text=html, content_type="text/html", charset="utf-8")


async def _handle_login(request: web.Request) -> web.Response:
    if request.method != "POST":
        return _login_page()
    data = await request.post()
    pwd = data.get("password", "")
    if _check_password(str(pwd)):
        token = _issue_token()
        resp = web.HTTPFound("/")
        resp.set_cookie(COOKIE_NAME, token, max_age=SESSION_TTL, httponly=True, samesite="Lax")
        return resp
    return _login_page("密码错误，请重试")


async def _proxy_http(request: web.Request):
    url = TARGET + request.raw_path
    headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in _SKIP_REQ_HEADERS
    }
    body = await request.read()
    async with ClientSession(timeout=ClientTimeout(total=None)) as sess:
        async with sess.request(
            request.method, url, headers=headers, data=body or None
        ) as upstream:
            resp_headers = {
                k: v for k, v in upstream.headers.items()
                if k.lower() not in _SKIP_RESP_HEADERS
            }
            ctype = upstream.headers.get("content-type", "").lower()
            if "text/html" in ctype:
                # HTML 响应：缓存并注入 crypto.randomUUID polyfill
                html = await upstream.read()
                return web.Response(
                    body=_inject_polyfill(html),
                    status=upstream.status,
                    headers=resp_headers,
                )
            out = web.StreamResponse(status=upstream.status, headers=resp_headers)
            await out.prepare(request)
            try:
                async for chunk in upstream.content.iter_any():
                    await out.write(chunk)
                await out.write_eof()
            except (asyncio.CancelledError, ConnectionError):
                raise
            return out


async def _proxy_ws(request: web.Request) -> web.WebSocketResponse:
    ws_client = web.WebSocketResponse()
    await ws_client.prepare(request)
    ws_url = TARGET.replace("http://", "ws://").replace("https://", "wss://") + request.raw_path
    async with ClientSession() as sess:
        try:
            async with sess.ws_connect(ws_url) as ws_server:
                async def c2s():
                    async for msg in ws_client:
                        if msg.type == WSMsgType.TEXT:
                            await ws_server.send_str(msg.data)
                        elif msg.type == WSMsgType.BINARY:
                            await ws_server.send_bytes(msg.data)
                        elif msg.type == WSMsgType.CLOSE:
                            await ws_server.close()
                            break
                        elif msg.type == WSMsgType.ERROR:
                            break

                async def s2c():
                    async for msg in ws_server:
                        if msg.type == WSMsgType.TEXT:
                            await ws_client.send_str(msg.data)
                        elif msg.type == WSMsgType.BINARY:
                            await ws_client.send_bytes(msg.data)
                        elif msg.type == WSMsgType.CLOSE:
                            await ws_client.close()
                            break
                        elif msg.type == WSMsgType.ERROR:
                            break

                await asyncio.gather(c2s(), s2c())
        except Exception as e:
            print(f"[dsh-proxy WS] 异常: {type(e).__name__}: {e}", flush=True)
            await ws_client.close()
    return ws_client


# ── /api-fs 文件系统 API（认证后可用，本地处理不反代上游）────────────────
# 供「添加工作区」远程三选一的 web 文件管理器（list）与 sshfs 挂载（mount/unmount）使用。

def _safe_abs(path: str) -> str:
    """解析为绝对路径，缺省用户主目录。"""
    path = (path or "").strip()
    if not path:
        path = os.path.expanduser("~")
    return os.path.abspath(os.path.expanduser(path))

async def _api_fs_list(request: web.Request) -> web.Response:
    path = _safe_abs(request.query.get("path", ""))
    if not os.path.isdir(path):
        return web.json_response({"error": f"不是目录: {path}"}, status=400)
    entries = []
    try:
        with os.scandir(path) as it:
            for e in it:
                try:
                    is_dir = e.is_dir()
                except OSError:
                    is_dir = False
                entries.append({"name": e.name, "isDir": is_dir})
    except PermissionError:
        return web.json_response({"error": f"无权限读取: {path}"}, status=403)
    entries.sort(key=lambda x: (not x["isDir"], x["name"].lower()))
    return web.json_response({"path": path, "entries": entries})

async def _api_fs_sshfs_mount(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "请求体不是合法 JSON"}, status=400)
    host = str(data.get("host", "")).strip()
    user = str(data.get("user", "")).strip()
    auth = data.get("auth") or {}
    remote_path = str(data.get("remotePath", "")).strip()
    mount_point = _safe_abs(str(data.get("mountPoint", "")))
    if not host or not user or not remote_path or not mount_point:
        return web.json_response(
            {"ok": False, "error": "参数不完整（host/user/remotePath/mountPoint 必填）"}, status=400)
    os.makedirs(mount_point, exist_ok=True)
    target = f"{user}@{host}:{remote_path}"
    if auth.get("type") == "key":
        key_path = os.path.abspath(os.path.expanduser(str(auth.get("keyPath", ""))))
        cmd = ["sshfs", "-o", f"IdentityFile={key_path}", "-o", "reconnect", target, mount_point]
    else:
        password = str(auth.get("password", ""))
        cmd = ["sshpass", "-p", password, "sshfs", "-o", "reconnect", target, mount_point]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        _, stderr = await proc.communicate()
    except FileNotFoundError as e:
        return web.json_response({"ok": False, "error": f"命令不存在: {e}"}, status=500)
    if proc.returncode == 0:
        return web.json_response({"ok": True, "mountPoint": mount_point, "remote": target})
    err = stderr.decode("utf-8", errors="replace").strip()[:500]
    return web.json_response({"ok": False, "error": err or f"sshfs 退出码 {proc.returncode}"})

async def _api_fs_sshfs_unmount(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "请求体不是合法 JSON"}, status=400)
    mount_point = _safe_abs(str(data.get("mountPoint", "")))
    proc = await asyncio.create_subprocess_exec(
        "fusermount3", "-u", mount_point,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    _, stderr = await proc.communicate()
    if proc.returncode == 0:
        return web.json_response({"ok": True})
    err = stderr.decode("utf-8", errors="replace").strip()[:300]
    return web.json_response({"ok": False, "error": err or f"退出码 {proc.returncode}"})


# ── /api-fs 增强：SSH 配置发现 + 本机/远程文件操作 ────────────────────────────

async def _json_body(request: web.Request) -> dict:
    try:
        return await request.json()
    except Exception:
        return {}


def _parse_ssh_config(content: str, source_user: str):
    """解析 ~/.ssh/config 文本为条目列表（Host/HostName/User/Port/IdentityFile/ProxyJump）。"""
    entries = []
    current = None
    for raw in content.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        lower = line.lower()
        if lower.startswith("host ") and not lower.startswith("hostname"):
            if current and current.get("host"):
                entries.append(current)
            host = line.split(None, 1)[1].strip()
            current = {"host": host, "sourceUser": source_user}
            continue
        if current is None:
            continue
        key, _, value = line.partition(" ")
        key = key.lower()
        value = value.strip().strip('"')
        if key == "hostname":
            current["hostname"] = value
        elif key == "user":
            current["user"] = value
        elif key == "port":
            current["port"] = value
        elif key == "identityfile":
            current["identityFile"] = value
        elif key == "proxyjump":
            current["proxyJump"] = value
    if current and current.get("host"):
        entries.append(current)
    return entries


async def _api_fs_ssh_configs(request: web.Request) -> web.Response:
    """发现本机所有用户 ~/.ssh/config 的 SSH 登录信息。读不了就跳过，不改权限；
    root 的 config 普通用户读不了时用 sudo -n 提权读取（只读不改）。"""
    configs = []
    seen = set()
    homes = []
    try:
        with open("/etc/passwd", encoding="utf-8", errors="ignore") as f:
            for line in f:
                parts = line.split(":")
                if len(parts) >= 6 and parts[5]:
                    homes.append((parts[0], parts[5]))
    except OSError:
        pass
    if not any(u == "root" for u, _ in homes):
        homes.append(("root", "/root"))
    for user, home in homes:
        cfg = os.path.join(home, ".ssh", "config")
        content = None
        try:
            with open(cfg, encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except OSError:
            if user == "root":
                proc = await asyncio.create_subprocess_exec(
                    "sudo", "-n", "cat", cfg,
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                out, _ = await proc.communicate()
                if proc.returncode == 0:
                    content = out.decode("utf-8", errors="ignore")
            if content is None:
                continue  # 不能读就下一个
        for entry in _parse_ssh_config(content, user):
            key = (entry.get("host"), entry.get("user"), entry.get("hostname"))
            if key in seen:
                continue
            seen.add(key)
            configs.append(entry)
    configs.sort(key=lambda e: (e.get("sourceUser", ""), e.get("host", "")))
    return web.json_response({"configs": configs})


async def _api_fs_mkdir(request: web.Request) -> web.Response:
    data = await _json_body(request)
    path = _safe_abs(str(data.get("path", "")))
    if not path:
        return web.json_response({"ok": False, "error": "path 必填"}, status=400)
    try:
        os.makedirs(path, exist_ok=True)
    except OSError as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)
    return web.json_response({"ok": True, "path": path})


async def _api_fs_rename(request: web.Request) -> web.Response:
    data = await _json_body(request)
    path = _safe_abs(str(data.get("path", "")))
    new_name = str(data.get("newName", "")).strip()
    if not path or not new_name or "/" in new_name:
        return web.json_response({"ok": False, "error": "path/newName 必填且 newName 不能含 /"}, status=400)
    target = os.path.join(os.path.dirname(path), new_name)
    try:
        os.rename(path, target)
    except OSError as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)
    return web.json_response({"ok": True, "path": target})


async def _api_fs_delete(request: web.Request) -> web.Response:
    data = await _json_body(request)
    path = _safe_abs(str(data.get("path", "")))
    if not path or path == "/":
        return web.json_response({"ok": False, "error": "路径无效"}, status=400)
    try:
        if os.path.isdir(path):
            os.rmdir(path)  # 仅空目录，避免误删数据
        else:
            os.unlink(path)
    except OSError as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)
    return web.json_response({"ok": True})


def _build_ssh_cmd(host: str, user: str, auth: dict, *args):
    ssh_opts = [
        "-o", "StrictHostKeyChecking=no",
        "-o", "ConnectTimeout=10",
        "-o", "BatchMode=yes",
    ]
    if auth.get("type") == "key":
        key = os.path.abspath(os.path.expanduser(str(auth.get("keyPath", ""))))
        ssh_opts += ["-o", f"IdentityFile={key}"]
    target = f"{user}@{host}" if user else host
    if auth.get("type") == "password":
        return ["sshpass", "-p", str(auth.get("password", ""))] + ["ssh"] + ssh_opts + [target] + list(args)
    return ["ssh"] + ssh_opts + [target] + list(args)


async def _run_ssh(host: str, user: str, auth: dict, *args, timeout: int = 25):
    cmd = _build_ssh_cmd(host, user, auth, *args)
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return proc.returncode, stdout.decode("utf-8", errors="ignore"), stderr.decode("utf-8", errors="ignore")
    except asyncio.TimeoutError:
        return 124, "", "ssh 超时"
    except FileNotFoundError as e:
        return 127, "", f"命令不存在: {e}"


# ── sftp（跨平台远程文件操作：Windows OpenSSH / Linux 均适用）───────────────

def _build_sftp_cmd(host: str, user: str, auth: dict):
    ssh_opts = [
        "-o", "StrictHostKeyChecking=no",
        "-o", "ConnectTimeout=10",
        "-o", "BatchMode=yes",
    ]
    if auth.get("type") == "key":
        key = os.path.abspath(os.path.expanduser(str(auth.get("keyPath", ""))))
        ssh_opts += ["-o", f"IdentityFile={key}"]
    target = f"{user}@{host}" if user else host
    if auth.get("type") == "password":
        return ["sshpass", "-p", str(auth.get("password", ""))] + ["sftp"] + ssh_opts + [target]
    return ["sftp"] + ssh_opts + [target]


async def _run_sftp(host: str, user: str, auth: dict, command: str, timeout: int = 25):
    cmd = _build_sftp_cmd(host, user, auth)
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        out, err = await asyncio.wait_for(
            proc.communicate(input=f"{command}\nquit\n".encode()), timeout=timeout)
        return proc.returncode, out.decode("utf-8", errors="ignore"), err.decode("utf-8", errors="ignore")
    except asyncio.TimeoutError:
        return 124, "", "sftp 超时"
    except FileNotFoundError as e:
        return 127, "", f"命令不存在: {e}"


# sftp ls -l 输出：权限(10) 链接(1) owner(1) group(1) 大小(1) 月(1) 日(1) 时间(1) 名称(可含空格)
_SFTP_LS_RE = re.compile(r"^([d-])[rwxsStT*]{9}\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+(.+)$")


def _sftp_path(path: str) -> str:
    """Windows 风格路径转 sftp POSIX 风格：C:\\Users\\x 或 C:/Users/x → /C:/Users/x。"""
    path = path.replace("\\", "/")
    if re.match(r"^[A-Za-z]:", path):
        path = "/" + path
    return path


async def _api_fs_remote_list(request: web.Request) -> web.Response:
    data = await _json_body(request)
    host = str(data.get("host", "")).strip()
    user = str(data.get("user", "")).strip()
    auth = data.get("auth") or {}
    path = _sftp_path(str(data.get("path", "")).strip() or ".")
    if not host:
        return web.json_response({"error": "host 必填"}, status=400)
    code, out, err = await _run_sftp(host, user, auth, f"ls -l {shlex.quote(path)}")
    if code != 0:
        return web.json_response({"error": err.strip() or f"exit {code}"}, status=400)
    entries = []
    for line in out.splitlines():
        m = _SFTP_LS_RE.match(line)
        if m:
            entries.append({"name": m.group(2).strip(), "isDir": m.group(1) == "d"})
    return web.json_response({"path": path, "entries": entries})


async def _api_fs_remote_pwd(request: web.Request) -> web.Response:
    data = await _json_body(request)
    host = str(data.get("host", "")).strip()
    user = str(data.get("user", "")).strip()
    auth = data.get("auth") or {}
    if not host:
        return web.json_response({"error": "host 必填"}, status=400)
    code, out, err = await _run_ssh(host, user, auth, "pwd")
    if code != 0:
        return web.json_response({"error": err.strip() or f"exit {code}"}, status=400)
    return web.json_response({"path": out.strip()})


async def _api_fs_remote_mkdir(request: web.Request) -> web.Response:
    data = await _json_body(request)
    host = str(data.get("host", "")).strip()
    user = str(data.get("user", "")).strip()
    auth = data.get("auth") or {}
    path = _sftp_path(str(data.get("path", "")).strip())
    if not host or not path:
        return web.json_response({"ok": False, "error": "host/path 必填"}, status=400)
    code, out, err = await _run_sftp(host, user, auth, f"mkdir {shlex.quote(path)}")
    if code != 0:
        return web.json_response({"ok": False, "error": err.strip() or out.strip() or f"exit {code}"}, status=400)
    return web.json_response({"ok": True})


async def _api_fs_remote_rename(request: web.Request) -> web.Response:
    data = await _json_body(request)
    host = str(data.get("host", "")).strip()
    user = str(data.get("user", "")).strip()
    auth = data.get("auth") or {}
    path = _sftp_path(str(data.get("path", "")).strip())
    new_name = str(data.get("newName", "")).strip()
    if not host or not path or not new_name or "/" in new_name:
        return web.json_response({"ok": False, "error": "host/path/newName 必填且 newName 不能含 /"}, status=400)
    target = os.path.join(os.path.dirname(path.rstrip("/")), new_name)
    code, out, err = await _run_sftp(host, user, auth, f"rename {shlex.quote(path)} {shlex.quote(target)}")
    if code != 0:
        return web.json_response({"ok": False, "error": err.strip() or out.strip() or f"exit {code}"}, status=400)
    return web.json_response({"ok": True, "path": target})


async def _api_fs_remote_delete(request: web.Request) -> web.Response:
    data = await _json_body(request)
    host = str(data.get("host", "")).strip()
    user = str(data.get("user", "")).strip()
    auth = data.get("auth") or {}
    path = _sftp_path(str(data.get("path", "")).strip())
    if not host or not path or path in ("/", "."):
        return web.json_response({"ok": False, "error": "路径无效"}, status=400)
    code, out, err = await _run_sftp(host, user, auth, f"rmdir {shlex.quote(path)}")
    if code != 0:
        # 目录非空则 rm 文件或整目录（sftp 无递归 rm，仅对文件/空目录生效）
        code2, out2, err2 = await _run_sftp(host, user, auth, f"rm {shlex.quote(path)}")
        if code2 != 0:
            return web.json_response(
                {"ok": False, "error": (err2.strip() or out2.strip() or f"exit {code2}")[:300]}, status=400)
    return web.json_response({"ok": True})


async def handle(request: web.Request):
    # 登录 / 登出入口
    if request.path == "/login":
        return await _handle_login(request)
    if request.path == "/logout":
        resp = web.HTTPFound("/")
        resp.del_cookie(COOKIE_NAME)
        return resp

    if not _authed(request):
        return _login_page()

    # /api-fs/* 本地处理（文件浏览 / sshfs 挂载 / 文件操作），不反代上游 harness
    if request.path == "/api-fs/list":
        return await _api_fs_list(request)
    if request.path == "/api-fs/sshfs-mount":
        return await _api_fs_sshfs_mount(request)
    if request.path == "/api-fs/sshfs-unmount":
        return await _api_fs_sshfs_unmount(request)
    if request.path == "/api-fs/ssh-configs":
        return await _api_fs_ssh_configs(request)
    if request.path == "/api-fs/mkdir":
        return await _api_fs_mkdir(request)
    if request.path == "/api-fs/rename":
        return await _api_fs_rename(request)
    if request.path == "/api-fs/delete":
        return await _api_fs_delete(request)
    if request.path == "/api-fs/remote-list":
        return await _api_fs_remote_list(request)
    if request.path == "/api-fs/remote-pwd":
        return await _api_fs_remote_pwd(request)
    if request.path == "/api-fs/remote-mkdir":
        return await _api_fs_remote_mkdir(request)
    if request.path == "/api-fs/remote-rename":
        return await _api_fs_remote_rename(request)
    if request.path == "/api-fs/remote-delete":
        return await _api_fs_remote_delete(request)

    upgrade = request.headers.get("upgrade", "")
    if upgrade.lower() == "websocket":
        return await _proxy_ws(request)
    return await _proxy_http(request)


def main() -> None:
    app = web.Application()
    app.router.add_route("*", "/{tail:.*}", handle)
    print(f"[dsh-proxy] 监听 {LISTEN_HOST}:{LISTEN_PORT} -> {TARGET}")
    web.run_app(app, host=LISTEN_HOST, port=LISTEN_PORT, print=None)


if __name__ == "__main__":
    main()
