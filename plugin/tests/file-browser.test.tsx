import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FileBrowser } from '../src/client/FileBrowser.tsx'

function jsonResponse(body: unknown): { ok: true; status: number; json: () => Promise<unknown> } {
  return { ok: true, status: 200, json: async () => body }
}

function expectDisabled(button: HTMLElement): void {
  expect((button as HTMLButtonElement).disabled).toBe(true)
}

interface BrowserProps {
  busy?: boolean
  onPicked: (path: string) => void
  onBack: () => void
  onCancel: () => void
  onError: (message: string) => void
}

function renderBrowser(overrides: Partial<BrowserProps> = {}) {
  const props: BrowserProps = {
    busy: false,
    onPicked: vi.fn(),
    onBack: vi.fn(),
    onCancel: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  }
  const view = render(
    <FileBrowser
      busy={props.busy ?? false}
      onPicked={props.onPicked}
      onBack={props.onBack}
      onCancel={props.onCancel}
      onError={props.onError}
    />,
  )
  return { ...view, props }
}

describe('FileBrowser', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists the initial home directory from /api-fs/list', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      path: '/home/vina',
      entries: [{ name: 'home', isDir: true }, { name: 'readme.md', isDir: false }],
    }))
    vi.stubGlobal('fetch', fetchMock)
    renderBrowser()
    expect(await screen.findByText('home')).toBeTruthy()
    expect(screen.getByText('readme.md')).toBeTruthy()
    expect(screen.getByText('/home/vina')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith('/api-fs/list?path=~')
  })

  it('enters a directory on click and lists its entries', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const p = decodeURIComponent(String(url).split('path=')[1] ?? '')
      if (p === '~' || p === '/home/vina') {
        return jsonResponse({ path: '/home/vina', entries: [{ name: 'home', isDir: true }] })
      }
      return jsonResponse({ path: p, entries: [{ name: 'vina', isDir: true }] })
    })
    vi.stubGlobal('fetch', fetchMock)
    renderBrowser()
    fireEvent.click(await screen.findByRole('button', { name: 'home' }))
    expect(await screen.findByRole('button', { name: 'vina' })).toBeTruthy()
    expect(screen.getByText('/home/vina/home')).toBeTruthy()
    expect(fetchMock).toHaveBeenLastCalledWith('/api-fs/list?path=%2Fhome%2Fvina%2Fhome')
  })

  it('goes up to the parent directory', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      path: '/home/vina', entries: [{ name: 'vina', isDir: true }],
    }))
    vi.stubGlobal('fetch', fetchMock)
    renderBrowser()
    await screen.findByRole('button', { name: 'vina' })
    fireEvent.click(screen.getByRole('button', { name: '上级目录' }))
    expect(fetchMock).toHaveBeenLastCalledWith('/api-fs/list?path=%2Fhome')
  })

  it('keeps the up affordance disabled at the root', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ path: '/', entries: [] }))
    vi.stubGlobal('fetch', fetchMock)
    renderBrowser()
    await screen.findByText('（空目录）')
    expectDisabled(screen.getByRole('button', { name: '上级目录' }))
  })

  it('picks the current directory', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ path: '/', entries: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const { props } = renderBrowser()
    await screen.findByText('（空目录）')
    fireEvent.click(screen.getByRole('button', { name: '选择此目录' }))
    expect(props.onPicked).toHaveBeenCalledWith('/')
  })

  it('disables picking while the owner is busy', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ path: '/', entries: [] }))
    vi.stubGlobal('fetch', fetchMock)
    renderBrowser({ busy: true })
    await screen.findByText('（空目录）')
    expectDisabled(screen.getByRole('button', { name: '选择此目录' }))
  })

  it('reports a rejected listing through onError', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('network down') })
    vi.stubGlobal('fetch', fetchMock)
    const { props } = renderBrowser()
    await waitFor(() => expect(props.onError).toHaveBeenCalledWith(expect.stringContaining('无法读取目录')))
  })

  it('reports a non-ok listing response through onError', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetchMock)
    const { props } = renderBrowser()
    await waitFor(() => expect(props.onError).toHaveBeenCalledWith(expect.stringContaining('无法读取目录')))
  })

  it('routes the back and cancel buttons', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ path: '/', entries: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const { props } = renderBrowser()
    await screen.findByText('（空目录）')
    fireEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(props.onBack).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(props.onCancel).toHaveBeenCalled()
  })
})
