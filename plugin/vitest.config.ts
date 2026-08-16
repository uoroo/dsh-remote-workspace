import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Two projects split on jsdom's origin: the remote-dialog suite must load
    // from the reverse-proxy host so window.location.hostname is not loopback
    // (jsdom's Location.hostname is non-configurable, so the URL has to be
    // set at environment creation).
    projects: [
      {
        test: {
          name: 'local',
          environment: 'jsdom',
          environmentOptions: { jsdom: { url: 'http://localhost:3000/' } },
          include: [
            'tests/hostname.test.ts',
            'tests/picker-flow.loopback.test.tsx',
            'tests/file-browser.test.tsx',
            'tests/sshfs-form.test.tsx',
          ],
          globals: true,
        },
      },
      {
        test: {
          name: 'remote',
          environment: 'jsdom',
          environmentOptions: { jsdom: { url: 'http://192.168.1.8:6677/' } },
          include: ['tests/picker-flow.remote.test.tsx'],
          globals: true,
        },
      },
    ],
  },
})
