import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PickerFlow } from '../src/client/PickerFlow.tsx'

function jsonResponse(body: unknown): { ok: true; status: number; json: () => Promise<unknown> } {
  return { ok: true, status: 200, json: async () => body }
}

const ROOT_LISTING = {
  path: '/',
  entries: [{ name: 'home', isDir: true }, { name: 'readme.md', isDir: false }],
}

function expectDisabled(button: HTMLElement): void {
  expect((button as HTMLButtonElement).disabled).toBe(true)
}

interface OwnerProps {
  pick: () => Promise<string | null>
  onPicked: (path: string) => void
  onCancel: () => void
  onError: (message: string) => void
}

function renderFlow(overrides: Partial<OwnerProps & { busy: boolean }> = {}) {
  const props = {
    busy: false,
    pick: vi.fn(async () => '/srv/data'),
    onPicked: vi.fn(),
    onCancel: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  }
  const view = render(
    <PickerFlow
      open
      busy={props.busy}
      pick={props.pick}
      onPicked={props.onPicked}
      onCancel={props.onCancel}
      onError={props.onError}
    />,
  )
  return { ...view, props }
}

describe('PickerFlow remote three-choice dialog', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the three options instead of auto-picking on a remote host', async () => {
    const { props } = renderFlow()
    expect(await screen.findByRole('dialog', { name: '选择添加工作区方式' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '原生浏览器弹窗' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Web 文件管理器' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'SSHFS 挂载远程文件夹' })).toBeTruthy()
    expect(screen.getByText('将在本机（Lenovo）弹出系统文件夹选择器，远程设备操作需远程桌面')).toBeTruthy()
    expect(props.pick).not.toHaveBeenCalled()
  })

  it('drives the native chooser from the first option and adopts the path', async () => {
    const { props } = renderFlow({ pick: vi.fn(async () => '/home/vina') })
    fireEvent.click(await screen.findByRole('button', { name: '原生浏览器弹窗' }))
    await waitFor(() => expect(props.onPicked).toHaveBeenCalledWith('/home/vina'))
  })

  it('reports a native-chooser cancellation from the first option', async () => {
    const { props } = renderFlow({ pick: vi.fn(async () => null) })
    fireEvent.click(await screen.findByRole('button', { name: '原生浏览器弹窗' }))
    await waitFor(() => expect(props.onCancel).toHaveBeenCalled())
  })

  it('closes the whole flow through the cancel button', async () => {
    const { props } = renderFlow()
    fireEvent.click(await screen.findByRole('button', { name: '取消' }))
    expect(props.onCancel).toHaveBeenCalled()
  })

  it('opens the web file manager and returns to the choice dialog', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(ROOT_LISTING))
    vi.stubGlobal('fetch', fetchMock)
    renderFlow()
    fireEvent.click(await screen.findByRole('button', { name: 'Web 文件管理器' }))
    expect(await screen.findByRole('dialog', { name: 'Web 文件管理器' })).toBeTruthy()
    expect(await screen.findByText('home')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(await screen.findByRole('dialog', { name: '选择添加工作区方式' })).toBeTruthy()
  })

  it('opens the sshfs mount form', async () => {
    renderFlow()
    fireEvent.click(await screen.findByRole('button', { name: 'SSHFS 挂载远程文件夹' }))
    expect(await screen.findByRole('dialog', { name: 'SSHFS 挂载远程文件夹' })).toBeTruthy()
  })

  it('disables every commit affordance while the owner is busy', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(ROOT_LISTING))
    vi.stubGlobal('fetch', fetchMock)
    const { props } = renderFlow({ busy: true })
    const native = await screen.findByRole('button', { name: '原生浏览器弹窗' })
    expectDisabled(native)
    fireEvent.click(native)
    expect(props.pick).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Web 文件管理器' }))
    expect(await screen.findByText('home')).toBeTruthy()
    expectDisabled(screen.getByRole('button', { name: '选择此目录' }))
    fireEvent.click(screen.getByRole('button', { name: '返回' }))
    fireEvent.click(await screen.findByRole('button', { name: 'SSHFS 挂载远程文件夹' }))
    expect(await screen.findByRole('dialog', { name: 'SSHFS 挂载远程文件夹' })).toBeTruthy()
    expectDisabled(screen.getByRole('button', { name: '挂载并选择' }))
  })
})
