/**
 * Sshfs mount form: mounts a remote directory through the reverse-proxy API
 * (`POST /api-fs/sshfs-mount`) and hands the resulting mount point back as the
 * picked path. A server-side rejection stays inline so the operator can fix
 * credentials; transport failures go to the owner's error surface.
 *
 * Enhancements: a saved-SSH-config selector at the top (discovered from every
 * local user's ~/.ssh/config), and "选择" buttons beside the mount point and
 * remote path that open in-app directory browsers (local FileBrowser for the
 * mount point, RemoteBrowser over sftp for the remote path).
 */
import { useEffect, useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import { createPortal } from 'react-dom'
import css from './SshfsForm.module.css'
import { FileBrowser } from './FileBrowser.tsx'
import { RemoteBrowser, type RemoteAuth } from './RemoteBrowser.tsx'

/** Sshfs form props: owner conversation plus the sub-view navigation callbacks. */
export interface SshfsFormProps {
  /** True while the owner adopts a picked path; disables the commit button. */
  busy: boolean
  /** The operator picked the mount point (absolute host path). */
  onPicked: (path: string) => void
  /** Return to the three-choice dialog. */
  onBack: () => void
  /** Dismiss the whole flow. */
  onCancel: () => void
  /** The mount request failed at the transport level; the owner shows its error surface. */
  onError: (message: string) => void
}

/** One entry parsed from a local user's ~/.ssh/config. */
interface SshConfig {
  host: string
  hostname?: string
  user?: string
  port?: string
  identityFile?: string
  proxyJump?: string
  sourceUser: string
}

/** Which sub-view (directory picker) is open, if any. */
type SubView = null | 'mountPicker' | 'remoteBrowser'

/** Extract a displayable failure message from a rejected promise. */
function failureMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

/**
 * Render the mount form: saved-SSH-config selector, host/user/authentication,
 * remote path and mount point (each with a "选择" directory picker), plus the
 * commit/navigation actions.
 */
export function SshfsForm(props: SshfsFormProps): ReactElement {
  const { busy, onPicked, onBack, onCancel, onError } = props
  const [sshConfigs, setSshConfigs] = useState<SshConfig[]>([])
  const [selectedConfig, setSelectedConfig] = useState('')
  const [host, setHost] = useState('')
  const [user, setUser] = useState('')
  const [auth, setAuth] = useState<'password' | 'key'>('password')
  const [password, setPassword] = useState('')
  const [keyPath, setKeyPath] = useState('')
  const [remotePath, setRemotePath] = useState('')
  const [mountPoint, setMountPoint] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [subView, setSubView] = useState<SubView>(null)

  /** Load every local user's saved SSH configs for the selector. */
  useEffect(() => {
    fetch('/api-fs/ssh-configs').then(
      async (response) => response.json() as Promise<{ configs?: SshConfig[] }>,
    ).then(
      (data) => {
        if (Array.isArray(data.configs)) setSshConfigs(data.configs)
      },
      () => { /* 读不到配置就不显示下拉，不影响手动输入 */ },
    )
  }, [])

  /** Fill the form from a picked saved SSH config. */
  const applyConfig = (hostName: string): void => {
    setSelectedConfig(hostName)
    const cfg = sshConfigs.find(c => c.host === hostName)
    if (!cfg) return
    setHost(cfg.host)
    if (cfg.user) setUser(cfg.user)
    if (cfg.identityFile) {
      setAuth('key')
      setKeyPath(cfg.identityFile)
    } else {
      setAuth('password')
    }
  }

  /** POST the mount request; adopt the mount point or keep the form for retry. */
  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const missing = auth === 'password'
      ? !host || !user || !password || !remotePath || !mountPoint
      : !host || !user || !keyPath || !remotePath || !mountPoint
    if (missing) {
      setInlineError('请填写所有必填字段')
      return
    }
    setSubmitting(true)
    setInlineError(null)
    const body = JSON.stringify({
      host,
      user,
      auth: auth === 'password' ? { type: 'password', password } : { type: 'key', keyPath },
      remotePath,
      mountPoint,
    })
    fetch('/api-fs/sshfs-mount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).then(
      async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<unknown>
      },
    ).then(
      (data) => {
        setSubmitting(false)
        if (typeof data !== 'object' || data === null) {
          setInlineError('挂载失败：未知错误')
          return
        }
        const record = data as { ok?: unknown; mountPoint?: unknown; error?: unknown }
        if (record.ok === true) {
          if (typeof record.mountPoint !== 'string' || record.mountPoint === '') {
            setInlineError('挂载失败：响应缺少挂载点')
            return
          }
          onPicked(record.mountPoint)
          return
        }
        const detail = typeof record.error === 'string' && record.error !== '' ? record.error : '未知错误'
        setInlineError(`挂载失败：${detail}`)
      },
      (reason: unknown) => {
        setSubmitting(false)
        onError(`挂载请求失败：${failureMessage(reason)}`)
      },
    )
  }

  // ── 子视图：挂载点选择（本机 FileBrowser）────────────────────────────────
  if (subView === 'mountPicker') {
    return (
      <FileBrowser
        busy={busy}
        initialPath="~"
        onPicked={(path) => { setMountPoint(path); setSubView(null) }}
        onBack={() => setSubView(null)}
        onCancel={onCancel}
        onError={onError}
      />
    )
  }

  // ── 子视图：远程路径选择（sftp RemoteBrowser）────────────────────────────
  if (subView === 'remoteBrowser') {
    return (
      <RemoteBrowser
        host={host}
        user={user}
        auth={{ type: auth, password, keyPath } as RemoteAuth}
        busy={busy}
        onPicked={(path) => { setRemotePath(path); setSubView(null) }}
        onBack={() => setSubView(null)}
        onCancel={onCancel}
        onError={onError}
      />
    )
  }

  return createPortal(
    <div className={css.overlay} onClick={onCancel}>
      <div role="dialog" aria-label="SSHFS 挂载远程文件夹" className={css.dialog} onClick={(event) => event.stopPropagation()}>
        <h2 className={css.title}>SSHFS 挂载远程文件夹</h2>
        <div className={css.field}>
          <label className={css.label} htmlFor="sshfs-config">已保存的 SSH 配置</label>
          <select id="sshfs-config" className={css.input} value={selectedConfig} onChange={(event) => applyConfig(event.target.value)}>
            <option value="">手动输入</option>
            {sshConfigs.map(cfg => (
              <option key={`${cfg.sourceUser}/${cfg.host}`} value={cfg.host}>
                {cfg.host}{cfg.hostname ? ` → ${cfg.hostname}` : ''}（{cfg.user || cfg.sourceUser}）
              </option>
            ))}
          </select>
        </div>
        <form className={css.form} onSubmit={submit}>
          <div className={css.field}>
            <label className={css.label} htmlFor="sshfs-host">主机</label>
            <input id="sshfs-host" className={css.input} value={host} onChange={event => setHost(event.target.value)} />
          </div>
          <div className={css.field}>
            <label className={css.label} htmlFor="sshfs-user">用户名</label>
            <input id="sshfs-user" className={css.input} value={user} onChange={event => setUser(event.target.value)} />
          </div>
          <div className={css.field}>
            <span className={css.label}>认证方式</span>
            <div className={css.radios}>
              <label className={css.radio}>
                <input type="radio" name="sshfs-auth" checked={auth === 'password'} onChange={() => setAuth('password')} />
                密码认证
              </label>
              <label className={css.radio}>
                <input type="radio" name="sshfs-auth" checked={auth === 'key'} onChange={() => setAuth('key')} />
                密钥认证
              </label>
            </div>
          </div>
          {auth === 'password'
            ? (
                <div className={css.field}>
                  <label className={css.label} htmlFor="sshfs-password">密码</label>
                  <input id="sshfs-password" className={css.input} type="password" value={password} onChange={event => setPassword(event.target.value)} />
                </div>
              )
            : (
                <div className={css.field}>
                  <label className={css.label} htmlFor="sshfs-key-path">密钥文件路径</label>
                  <input id="sshfs-key-path" className={css.input} value={keyPath} onChange={event => setKeyPath(event.target.value)} />
                </div>
              )}
          <div className={css.fieldWithButton}>
            <div className={css.field}>
              <label className={css.label} htmlFor="sshfs-remote-path">远程路径</label>
              <input id="sshfs-remote-path" className={css.input} value={remotePath} onChange={event => setRemotePath(event.target.value)} />
            </div>
            <button type="button" className={css.selectButton} disabled={!host || !user} onClick={() => setSubView('remoteBrowser')} title="打开远程目录选择器">选择</button>
          </div>
          <div className={css.fieldWithButton}>
            <div className={css.field}>
              <label className={css.label} htmlFor="sshfs-mount-point">挂载点</label>
              <input id="sshfs-mount-point" className={css.input} value={mountPoint} onChange={event => setMountPoint(event.target.value)} />
            </div>
            <button type="button" className={css.selectButton} onClick={() => setSubView('mountPicker')} title="打开本机目录选择器">选择</button>
          </div>
          {inlineError !== null && <div className={css.error} role="alert">{inlineError}</div>}
          <div className={css.actions}>
            <button type="submit" className={css.actionButton} disabled={busy || submitting}>挂载并选择</button>
            <button type="button" className={css.actionButton} onClick={onBack}>返回</button>
            <button type="button" className={css.actionButton} onClick={onCancel}>取消</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
