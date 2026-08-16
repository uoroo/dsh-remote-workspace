/**
 * The three-choice picking occupant (package-internal; the `./client` surface
 * exposes only the Loader exports). Same-package tests exercise it directly
 * through this module.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
// Type-only: the owner contract of the directory-flow holes.
import type { DirectoryFlowOwnerProps } from '@deepseek-ai/dsh-client-ui-workspace/client'
import { FileBrowser } from './FileBrowser.tsx'
import { SshfsForm } from './SshfsForm.tsx'
import css from './PickerFlow.module.css'

/** Injected face: the wire call the flow drives (bound in apply's closure). */
export interface PickerFlowInjected {
  /** Ask the local Host to open its native single-directory chooser. */
  pick: () => Promise<string | null>
}

/**
 * The page is operated from the harness machine itself, so the native OS
 * chooser pops where the operator can see it.
 * @param hostname - `window.location.hostname` (already lowercased by URL parsing).
 * @returns true for localhost, any 127.* address, and both IPv6 loopback spellings.
 */
export function isLoopbackHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  return lower === 'localhost' || lower.startsWith('127.') || lower === '::1' || lower === '[::1]'
}

type Mode = 'idle' | 'chooser' | 'browser' | 'sshfs'

/** Extract a displayable failure message from a rejected promise. */
function failureMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

/**
 * Directory-flow occupant: on a loopback host each rising `open` edge runs
 * exactly one native pick (renderless, same armed/alive ref contract as the
 * plain native flow); remote hosts get the three-choice dialog instead. The
 * owner withdrawing `open` closes any sub-view and re-arms the next request.
 * @param props - owner conversation plus the injected pick call.
 * @returns nothing on loopback/closed; otherwise the choice dialog or a sub-view.
 */
export function PickerFlow(props: DirectoryFlowOwnerProps & PickerFlowInjected): ReactElement | null {
  const { open, busy, onPicked, onCancel, onError, pick } = props
  const [mode, setMode] = useState<Mode>('idle')
  // True while a native chooser launched from the dialog is pending; guards
  // the option buttons against launching a second chooser.
  const [picking, setPicking] = useState(false)
  const armed = useRef(false)
  // Callbacks ride a ref so a settled pick reports through the owner's latest
  // handlers, not the ones captured when the chooser opened.
  const outcome = useRef(props)
  outcome.current = props
  // Unmount (HMR replacing the occupant) discards settlements wholesale: the
  // dead instance must neither adopt a path nor drive the owner's error
  // surface. The wire carries no per-request abort, so the host-side chooser
  // survives until answered — its answer just lands nowhere.
  const alive = useRef(true)
  useEffect(() => {
    // StrictMode's development replay runs the cleanup once before the real
    // lifetime: re-arm on setup or every outcome would be discarded.
    alive.current = true
    return () => { alive.current = false }
  }, [])

  /** Run one native pick and report its single outcome. */
  const runPick = (): void => {
    setPicking(true)
    pick().then(
      (path) => {
        if (!alive.current) return
        setPicking(false)
        if (path === null) outcome.current.onCancel(); else outcome.current.onPicked(path)
      },
      (reason: unknown) => {
        if (!alive.current) return
        setPicking(false)
        outcome.current.onError(failureMessage(reason))
      },
    )
  }

  useEffect(() => {
    if (!open) {
      armed.current = false
      setMode('idle')
      return
    }
    if (armed.current) return
    armed.current = true
    // The hostname is read at the open edge: a reload or navigation is
    // required to change it, and each open re-evaluates.
    if (isLoopbackHostname(window.location.hostname)) {
      runPick()
    } else {
      setMode('chooser')
    }
    // The armed ref makes this an edge trigger: only `open` re-runs it.
  }, [open])

  if (!open || mode === 'idle') return null
  if (mode === 'browser') {
    return (
      <FileBrowser
        busy={busy}
        onPicked={onPicked}
        onBack={() => setMode('chooser')}
        onCancel={onCancel}
        onError={onError}
      />
    )
  }
  if (mode === 'sshfs') {
    return (
      <SshfsForm
        busy={busy}
        onPicked={onPicked}
        onBack={() => setMode('chooser')}
        onCancel={onCancel}
        onError={onError}
      />
    )
  }
  return createPortal(
    <div className={css.overlay} onClick={onCancel}>
      <div role="dialog" aria-label="选择添加工作区方式" className={css.dialog} onClick={(event) => event.stopPropagation()}>
        <h2 className={css.title}>选择添加工作区方式</h2>
        <div className={css.options}>
          <div className={css.option}>
            <button type="button" className={css.optionButton} disabled={busy || picking} onClick={runPick}>原生浏览器弹窗</button>
            <span className={css.optionHint}>将在本机（Lenovo）弹出系统文件夹选择器，远程设备操作需远程桌面</span>
          </div>
          <div className={css.option}>
            <button type="button" className={css.optionButton} onClick={() => setMode('browser')}>Web 文件管理器</button>
            <span className={css.optionHint}>在当前页面浏览本机文件系统</span>
          </div>
          <div className={css.option}>
            <button type="button" className={css.optionButton} onClick={() => setMode('sshfs')}>SSHFS 挂载远程文件夹</button>
            <span className={css.optionHint}>挂载远程服务器文件夹并选择挂载点</span>
          </div>
        </div>
        <div className={css.actions}>
          <button type="button" className={css.actionButton} onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
