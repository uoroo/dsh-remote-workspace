import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PickerFlow } from '../src/client/PickerFlow.tsx'

interface OwnerProps {
  open: boolean
  busy?: boolean
  pick: () => Promise<string | null>
  onPicked: (path: string) => void
  onCancel: () => void
  onError: (message: string) => void
}

function renderFlow(overrides: Partial<OwnerProps> = {}) {
  const props: OwnerProps = {
    open: true,
    busy: false,
    pick: vi.fn(async () => '/srv/data'),
    onPicked: vi.fn(),
    onCancel: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  }
  const view = render(
    <PickerFlow
      open={props.open}
      busy={props.busy ?? false}
      pick={props.pick}
      onPicked={props.onPicked}
      onCancel={props.onCancel}
      onError={props.onError}
    />,
  )
  return { ...view, props }
}

describe('PickerFlow loopback behavior', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('runs exactly one native pick per open rise on a loopback host', async () => {
    const { props, rerender } = renderFlow()
    await waitFor(() => expect(props.onPicked).toHaveBeenCalledWith('/srv/data'))
    expect(props.pick).toHaveBeenCalledTimes(1)
    // Re-renders while open stays true must not launch a second chooser.
    rerender(<PickerFlow open busy={false} pick={props.pick} onPicked={props.onPicked} onCancel={props.onCancel} onError={props.onError} />)
    expect(props.pick).toHaveBeenCalledTimes(1)
  })

  it('reports a native-pick cancellation as onCancel on loopback', async () => {
    const { props } = renderFlow({ pick: vi.fn(async () => null) })
    await waitFor(() => expect(props.onCancel).toHaveBeenCalled())
    expect(props.onPicked).not.toHaveBeenCalled()
  })

  it('reports a native-pick rejection as onError on loopback', async () => {
    const { props } = renderFlow({ pick: vi.fn(async () => { throw new Error('chooser unavailable') }) })
    await waitFor(() => expect(props.onError).toHaveBeenCalledWith('chooser unavailable'))
  })

  it('re-arms after the owner withdraws open and re-raises it', async () => {
    const { props, rerender } = renderFlow({ open: false })
    expect(props.pick).not.toHaveBeenCalled()
    rerender(<PickerFlow open busy={false} pick={props.pick} onPicked={props.onPicked} onCancel={props.onCancel} onError={props.onError} />)
    await waitFor(() => expect(props.pick).toHaveBeenCalledTimes(1))
    rerender(<PickerFlow open={false} busy={false} pick={props.pick} onPicked={props.onPicked} onCancel={props.onCancel} onError={props.onError} />)
    rerender(<PickerFlow open busy={false} pick={props.pick} onPicked={props.onPicked} onCancel={props.onCancel} onError={props.onError} />)
    await waitFor(() => expect(props.pick).toHaveBeenCalledTimes(2))
  })

  it('renders nothing while open is false', () => {
    const { container } = renderFlow({ open: false })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing while auto-picking on loopback', async () => {
    const { props, container } = renderFlow()
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    // Let the pending pick settle inside the test so no state update escapes it.
    await waitFor(() => expect(props.onPicked).toHaveBeenCalled())
  })
})
