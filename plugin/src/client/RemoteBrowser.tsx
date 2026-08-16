/**
 * Remote directory browser: lists a remote host's filesystem through the
 * reverse-proxy sftp API (`/api-fs/remote-*`) and hands the current
 * directory back as the picked path. Supports creating, renaming and
 * deleting folders. Initial path follows the SSH login directory (or an
 * explicit initialPath).
 */
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import css from './FileBrowser.module.css'

/** One filesystem entry as served by the remote APIs. */
interface FileEntry {
  name: string
  isDir: boolean
}

/** SSH authentication payload shared with the mount form. */
export interface RemoteAuth {
  type?: 'password' | 'key'
  password?: string
  keyPath?: string
}

/** Remote browser props: target host plus owner conversation callbacks. */
export interface RemoteBrowserProps {
  host: string
  user: string
  auth: RemoteAuth
  /** True while the owner adopts a picked path; disables the commit button. */
  busy: boolean
  /** Initial remote directory; defaults to the SSH login directory. */
  initialPath?: string
  /** The operator picked the current remote directory. */
  onPicked: (path: string) => void
  /** Return to the three-choice dialog. */
  onBack: () => void
  /** Dismiss the whole flow. */
  onCancel: () => void
  /** Any operation failed; the owner shows its error surface. */
  onError: (message: string) => void
}

/** POST a remote /api-fs RPC and decode its JSON. */
function remoteRpc(method: string, body: unknown): Promise<{
  ok?: boolean
  error?: string
  path?: string
  entries?: FileEntry[]
}> {
  return fetch(method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (response) => response.json() as Promise<{ ok?: boolean; error?: string; path?: string; entries?: FileEntry[] }>)
}

/** Join a child name onto a remote directory path. */
function joinPath(parent: string, name: string): string {
  return parent === '/' ? `/${name}` : `${parent}/${name}`
}

/** Parent directory of a remote path; the root stays the root. */
function parentOf(path: string): string {
  if (path === '/') return '/'
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path
  const cut = trimmed.lastIndexOf('/')
  return cut <= 0 ? '/' : trimmed.slice(0, cut)
}

/** Extract a displayable failure message from a rejected promise. */
function failureMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

/**
 * Render the remote directory browser: header path, entry list with
 * rename/delete actions, folder creation, and the commit/navigation actions.
 */
export function RemoteBrowser(props: RemoteBrowserProps): ReactElement {
  const { host, user, auth, busy, initialPath, onPicked, onBack, onCancel, onError } = props
  const [path, setPath] = useState<string>('')
  const [entries, setEntries] = useState<readonly FileEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const session = { host, user, auth }

  /** Reload the given remote directory. */
  const reload = (current: string): void => {
    setLoading(true)
    remoteRpc('/api-fs/remote-list', { ...session, path: current }).then(
      (data) => {
        if (data.error) throw new Error(data.error)
        if (typeof data.path === 'string' && data.path !== '') setPath(data.path)
        setEntries(data.entries ?? [])
        setLoading(false)
      },
      (reason: unknown) => {
        setLoading(false)
        onError(`无法读取远程目录：${failureMessage(reason)}`)
      },
    )
  }

  useEffect(() => {
    if (path === '') {
      // First mount: use the explicit initial path, else the SSH login dir.
      if (initialPath && initialPath !== '') {
        setPath(initialPath)
        return
      }
      remoteRpc('/api-fs/remote-pwd', session).then(
        (data) => setPath(data.path || '.'),
        () => setPath('.'),
      )
      return
    }
    reload(path)
    // Reload only when the path changes; session identity is stable per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  /** Create a folder under the current directory, then reload. */
  const createFolder = (): void => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    remoteRpc('/api-fs/remote-mkdir', { ...session, path: joinPath(path, name) }).then(
      (data) => {
        if (data.ok !== true) throw new Error(data.error || '新建失败')
        setNewName('')
        reload(path)
      },
      (reason: unknown) => onError(`新建失败：${failureMessage(reason)}`),
    ).finally(() => setCreating(false))
  }

  /** Rename a folder entry. */
  const renameFolder = (name: string): void => {
    const newValue = window.prompt('重命名远程文件夹', name)
    if (newValue === null) return
    const trimmed = newValue.trim()
    if (!trimmed || trimmed === name) return
    remoteRpc('/api-fs/remote-rename', { ...session, path: joinPath(path, name), newName: trimmed }).then(
      (data) => {
        if (data.ok !== true) throw new Error(data.error || '重命名失败')
        reload(path)
      },
      (reason: unknown) => onError(`重命名失败：${failureMessage(reason)}`),
    )
  }

  /** Delete a folder entry (empty folders only, server-enforced). */
  const deleteFolder = (name: string): void => {
    if (!window.confirm(`确定删除远程文件夹「${name}」？（仅空目录可删除）`)) return
    remoteRpc('/api-fs/remote-delete', { ...session, path: joinPath(path, name) }).then(
      (data) => {
        if (data.ok !== true) throw new Error(data.error || '删除失败')
        reload(path)
      },
      (reason: unknown) => onError(`删除失败：${failureMessage(reason)}`),
    )
  }

  return createPortal(
    <div className={css.overlay} onClick={onCancel}>
      <div role="dialog" aria-label="远程目录选择" className={css.dialog} onClick={(event) => event.stopPropagation()}>
        <h2 className={css.title}>远程目录选择（{host}）</h2>
        <div className={css.path} title={path}>{path || '（获取登录路径中…）'}</div>
        <div className={css.newRow}>
          <input
            className={css.newInput}
            placeholder="新文件夹名称"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') createFolder() }}
          />
          <button type="button" className={css.actionButton} disabled={creating || !newName.trim()} onClick={createFolder}>新建文件夹</button>
        </div>
        <div className={css.list}>
          {loading
            ? <div className={css.status} role="status">加载中…</div>
            : entries.length === 0
              ? <div className={css.status}>（空目录）</div>
              : entries.map(entry => (
                  <div key={entry.name} className={css.row}>
                    {entry.isDir
                      ? (
                          <button type="button" className={css.entryButton} onClick={() => setPath(joinPath(path, entry.name))}>
                            {entry.name}
                          </button>
                        )
                      : (
                          <span className={css.file}>{entry.name}</span>
                        )}
                    {entry.isDir && (
                      <span className={css.rowActions}>
                        <button type="button" className={css.miniButton} onClick={() => renameFolder(entry.name)}>重命名</button>
                        <button type="button" className={css.miniButton} onClick={() => deleteFolder(entry.name)}>删除</button>
                      </span>
                    )}
                  </div>
                ))}
        </div>
        <div className={css.actions}>
          <button type="button" className={css.actionButton} disabled={path === '/' || loading} onClick={() => setPath(parentOf(path))}>上级目录</button>
          <button type="button" className={css.actionButton} disabled={busy || loading} onClick={() => onPicked(path)}>选择此目录</button>
          <button type="button" className={css.actionButton} onClick={onBack}>返回</button>
          <button type="button" className={css.actionButton} onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
