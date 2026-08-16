/**
 * In-app directory browser: lists the harness machine's filesystem through
 * the reverse-proxy API (`GET /api-fs/list?path=…`) and hands the current
 * directory back as the picked path. Supports creating, renaming and
 * deleting folders. Initial path defaults to the user's home (~).
 */
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import css from './FileBrowser.module.css'

/** One filesystem entry as served by /api-fs/list. */
interface FileEntry {
  name: string
  isDir: boolean
}

/** Browser props: owner conversation plus the sub-view navigation callbacks. */
export interface FileBrowserProps {
  /** True while the owner adopts a picked path; disables the commit button. */
  busy: boolean
  /** Initial directory; empty or '~' means the user's home. */
  initialPath?: string
  /** The operator picked the current directory (absolute host path). */
  onPicked: (path: string) => void
  /** Return to the three-choice dialog. */
  onBack: () => void
  /** Dismiss the whole flow. */
  onCancel: () => void
  /** Listing failed (transport or response shape); the owner shows its error surface. */
  onError: (message: string) => void
}

/** Join a child name onto a parent directory path ('~' expands server-side). */
function joinPath(parent: string, name: string): string {
  const base = parent === '' ? '~' : parent
  return base === '/' ? `/${name}` : `${base}/${name}`
}

/** Parent directory of an absolute path; the root stays the root. */
function parentOf(path: string): string {
  if (path === '' || path === '~' || path === '/') return '~'
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path
  const cut = trimmed.lastIndexOf('/')
  return cut <= 0 ? '/' : trimmed.slice(0, cut)
}

/** Extract a displayable failure message from a rejected promise. */
function failureMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

/**
 * Render the directory browser: header path, entry list (directories
 * navigable, with rename/delete actions), folder creation, and the
 * commit/navigation actions.
 */
export function FileBrowser(props: FileBrowserProps): ReactElement {
  const { busy, initialPath, onPicked, onBack, onCancel, onError } = props
  const [path, setPath] = useState<string>(initialPath && initialPath !== '' ? initialPath : '~')
  const [entries, setEntries] = useState<readonly FileEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  /** Reload the current directory listing. */
  const reload = (): void => {
    setLoading(true)
    fetch(`/api-fs/list?path=${encodeURIComponent(path)}`).then(
      async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data: unknown = await response.json()
        if (typeof data !== 'object' || data === null || !Array.isArray((data as { entries?: unknown }).entries)) {
          throw new Error('响应格式错误')
        }
        return data
      },
    ).then(
      (data) => {
        const record = data as { path?: unknown; entries: unknown }
        if (typeof record.path === 'string' && record.path !== '') setPath(record.path)
        const list = (record.entries as unknown[]).map((item) => {
          const entry = item as { name?: unknown; isDir?: unknown }
          return { name: String(entry.name ?? ''), isDir: entry.isDir === true }
        })
        setEntries(list)
        setLoading(false)
      },
      (reason: unknown) => {
        setLoading(false)
        onError(`无法读取目录：${failureMessage(reason)}`)
      },
    )
  }

  useEffect(reload, [path])

  /** Create a folder under the current directory, then reload. */
  const createFolder = (): void => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    fetch('/api-fs/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: joinPath(path, name) }),
    }).then(
      async (response) => {
        const data = await response.json() as { ok?: boolean; error?: string }
        if (!response.ok || data.ok !== true) throw new Error(data.error || `HTTP ${response.status}`)
        setNewName('')
        reload()
      },
      (reason: unknown) => onError(`新建失败：${failureMessage(reason)}`),
    ).finally(() => setCreating(false))
  }

  /** Rename a folder entry. */
  const renameFolder = (name: string): void => {
    const newValue = window.prompt('重命名文件夹', name)
    if (newValue === null) return
    const trimmed = newValue.trim()
    if (!trimmed || trimmed === name) return
    fetch('/api-fs/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: joinPath(path, name), newName: trimmed }),
    }).then(
      async (response) => {
        const data = await response.json() as { ok?: boolean; error?: string }
        if (!response.ok || data.ok !== true) throw new Error(data.error || `HTTP ${response.status}`)
        reload()
      },
      (reason: unknown) => onError(`重命名失败：${failureMessage(reason)}`),
    )
  }

  /** Delete a folder entry (empty folders only, server-enforced). */
  const deleteFolder = (name: string): void => {
    if (!window.confirm(`确定删除文件夹「${name}」？（仅空目录可删除）`)) return
    fetch('/api-fs/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: joinPath(path, name) }),
    }).then(
      async (response) => {
        const data = await response.json() as { ok?: boolean; error?: string }
        if (!response.ok || data.ok !== true) throw new Error(data.error || `HTTP ${response.status}`)
        reload()
      },
      (reason: unknown) => onError(`删除失败：${failureMessage(reason)}`),
    )
  }

  return createPortal(
    <div className={css.overlay} onClick={onCancel}>
      <div role="dialog" aria-label="Web 文件管理器" className={css.dialog} onClick={(event) => event.stopPropagation()}>
        <h2 className={css.title}>Web 文件管理器</h2>
        <div className={css.path} title={path}>{path}</div>
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
          <button type="button" className={css.actionButton} disabled={path === '/' || path === '~' || loading} onClick={() => setPath(parentOf(path))}>上级目录</button>
          <button type="button" className={css.actionButton} disabled={busy || loading} onClick={() => onPicked(path === '~' ? '' : path)}>选择此目录</button>
          <button type="button" className={css.actionButton} onClick={onBack}>返回</button>
          <button type="button" className={css.actionButton} onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
