/**
 * Browser half of workspace-picker-plus: fills ui-workspace's two
 * directory-flow holes with the three-choice picking occupant. On loopback
 * hosts it keeps the native interaction (one direct OS pick per `open` rise);
 * remote hosts get a dialog offering the native chooser, an in-app web file
 * browser over the reverse-proxy API, or an sshfs mount form. Mounting this
 * package therefore replaces the plain native flow with one cordis.yml row.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the SlotMap merge declaring the directory-flow holes.
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { PickerFlowInjected } from './PickerFlow.tsx'
import { PickerFlow } from './PickerFlow.tsx'

/** Required services (cordis fiber inject): the slot registry and the wire-facing workspace service. */
export const inject = ['slots', 'workspaces']

/**
 * Client plugin body: register the three-choice flow into both
 * directory-flow holes through `slots.inject()` because the ui-workspace
 * entries may activate later or replace their declarations.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const injected = (): PickerFlowInjected => ({ pick: () => ctx.workspaces.pickDirectory() })
  // Both declaration lifetimes must be live before the pair installs; the
  // generator makes the two registrations one transactional effect. The
  // outer/inner nesting order is arbitrary; neither hole has precedence.
  ctx.slots.inject('conversation.hero.workspace.directoryFlow', () =>
    ctx.slots.inject('sidebar.workspaces.directoryFlow', function* () {
      // single-kind shadow: 最低 priority 渲染。dsh-remote 用 -100 注册了同名
      // slot（本机/远程对话框），这里用 -200 确保三选一赢得渲染权。
      yield ctx.slots.register({
        name: 'conversation.hero.workspace.directoryFlow', inject: injected, priority: -200,
      }, PickerFlow)
      yield ctx.slots.register({
        name: 'sidebar.workspaces.directoryFlow', inject: injected, priority: -200,
      }, PickerFlow)
    }))
}
