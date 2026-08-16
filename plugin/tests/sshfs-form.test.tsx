import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SshfsForm } from '../src/client/SshfsForm.tsx'

function jsonResponse(body: unknown): { ok: true; status: number; json: () => Promise<unknown> } {
  return { ok: true, status: 200, json: async () => body }
}

function expectDisabled(button: HTMLElement): void {
  expect((button as HTMLButtonElement).disabled).toBe(true)
}

function alertText(): string | null {
  return screen.getByRole('alert').textContent
}

interface FormProps {
  busy?: boolean
  onPicked: (path: string) => void
  onBack: () => void
  onCancel: () => void
  onError: (message: string) => void
}

function renderForm(overrides: Partial<FormProps> = {}) {
  const props: FormProps = {
    busy: false,
    onPicked: vi.fn(),
    onBack: vi.fn(),
    onCancel: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  }
  const view = render(
    <SshfsForm
      busy={props.busy ?? false}
      onPicked={props.onPicked}
      onBack={props.onBack}
      onCancel={props.onCancel}
      onError={props.onError}
    />,
  )
  return { ...view, props }
}

function fillPasswordFields(): void {
  fireEvent.change(screen.getByLabelText('主机'), { target: { value: 'nas.example.com' } })
  fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'vina' } })
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret' } })
  fireEvent.change(screen.getByLabelText('远程路径'), { target: { value: '/srv/data' } })
  fireEvent.change(screen.getByLabelText('挂载点'), { target: { value: '/mnt/nas' } })
}

/** Mount-time fetch mock: answers the ssh-configs preload, delegating everything else. */
function configAwareMock(handler: (url: string, init?: { method?: string; body?: string }) => unknown) {
  return vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
    if (String(url).includes('/api-fs/ssh-configs')) return jsonResponse({ configs: [] })
    return handler(url, init)
  })
}

describe('SshfsForm', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects an incomplete form inline without calling the mount API', async () => {
    const fetchMock = configAwareMock(() => jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    renderForm()
    await screen.findByLabelText('已保存的 SSH 配置')
    fireEvent.click(screen.getByRole('button', { name: '挂载并选择' }))
    expect(alertText()).toContain('请填写所有必填字段')
    expect(fetchMock).not.toHaveBeenCalledWith('/api-fs/sshfs-mount', expect.anything())
  })

  it('mounts with password auth and adopts the returned mount point', async () => {
    const fetchMock = configAwareMock(() => jsonResponse({ ok: true, mountPoint: '/mnt/nas' }))
    vi.stubGlobal('fetch', fetchMock)
    const { props } = renderForm()
    await screen.findByLabelText('已保存的 SSH 配置')
    fillPasswordFields()
    fireEvent.click(screen.getByRole('button', { name: '挂载并选择' }))
    await waitFor(() => expect(props.onPicked).toHaveBeenCalledWith('/mnt/nas'))
    expect(fetchMock).toHaveBeenCalledWith('/api-fs/sshfs-mount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'nas.example.com',
        user: 'vina',
        auth: { type: 'password', password: 'secret' },
        remotePath: '/srv/data',
        mountPoint: '/mnt/nas',
      }),
    })
  })

  it('mounts with key auth and drops the password field', async () => {
    const fetchMock = configAwareMock(() => jsonResponse({ ok: true, mountPoint: '/mnt/nas' }))
    vi.stubGlobal('fetch', fetchMock)
    renderForm()
    await screen.findByLabelText('已保存的 SSH 配置')
    fireEvent.click(screen.getByLabelText('密钥认证'))
    expect(screen.queryByLabelText('密码')).toBeNull()
    fireEvent.change(screen.getByLabelText('主机'), { target: { value: 'nas.example.com' } })
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'vina' } })
    fireEvent.change(screen.getByLabelText('密钥文件路径'), { target: { value: '/home/vina/.ssh/id_ed25519' } })
    fireEvent.change(screen.getByLabelText('远程路径'), { target: { value: '/srv/data' } })
    fireEvent.change(screen.getByLabelText('挂载点'), { target: { value: '/mnt/nas' } })
    fireEvent.click(screen.getByRole('button', { name: '挂载并选择' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const mountCall = fetchMock.mock.calls.find(call => String(call[0]).includes('sshfs-mount'))
    const callBody = String(mountCall?.[1]?.body)
    expect(JSON.parse(callBody)).toEqual({
      host: 'nas.example.com',
      user: 'vina',
      auth: { type: 'key', keyPath: '/home/vina/.ssh/id_ed25519' },
      remotePath: '/srv/data',
      mountPoint: '/mnt/nas',
    })
  })

  it('shows the server-side mount failure inline and keeps the form', async () => {
    const fetchMock = configAwareMock(() => jsonResponse({ ok: false, error: 'authentication failed' }))
    vi.stubGlobal('fetch', fetchMock)
    const { props } = renderForm()
    await screen.findByLabelText('已保存的 SSH 配置')
    fillPasswordFields()
    fireEvent.click(screen.getByRole('button', { name: '挂载并选择' }))
    await waitFor(() => expect(alertText()).toContain('挂载失败：authentication failed'))
    expect(props.onPicked).not.toHaveBeenCalled()
    expect(props.onError).not.toHaveBeenCalled()
  })

  it('reports a transport failure through onError', async () => {
    const fetchMock = configAwareMock(() => { throw new Error('network down') })
    vi.stubGlobal('fetch', fetchMock)
    const { props } = renderForm()
    await screen.findByLabelText('已保存的 SSH 配置')
    fillPasswordFields()
    fireEvent.click(screen.getByRole('button', { name: '挂载并选择' }))
    await waitFor(() => expect(props.onError).toHaveBeenCalledWith(expect.stringContaining('挂载请求失败')))
  })

  it('disables mounting while the owner is busy', () => {
    renderForm({ busy: true })
    expectDisabled(screen.getByRole('button', { name: '挂载并选择' }))
  })

  it('routes the back and cancel buttons', () => {
    const { props } = renderForm()
    fireEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(props.onBack).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(props.onCancel).toHaveBeenCalled()
  })
})
