'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { loadConfig, DEFAULTS } = require('../src/config')

test('loadConfig requires MC_PORT', () => {
  assert.throws(() => loadConfig({}), /MC_PORT is required/)
  assert.throws(() => loadConfig({ MC_PORT: '   ' }), /MC_PORT is required/)
})

test('loadConfig applies defaults', () => {
  const config = loadConfig({ MC_PORT: '54321' })
  assert.equal(config.host, DEFAULTS.host)
  assert.equal(config.port, 54321)
  assert.equal(config.username, 'asche_companion')
  assert.equal(config.owner, 'asche_v')
  assert.equal(config.version, '26.1')
  assert.equal(config.followDistance, 2)
  assert.equal(config.statusIntervalMs, 30000)
  assert.equal(config.reconnectAttempts, 3)
})

test('loadConfig reads custom values', () => {
  const config = loadConfig({
    MC_HOST: '192.168.1.20',
    MC_PORT: '60000',
    MC_USERNAME: 'helper',
    MC_OWNER: 'steve',
    MC_VERSION: '26.1',
    MC_FOLLOW_DISTANCE: '3.5',
    MC_STATUS_INTERVAL_MS: '0',
    MC_RECONNECT_ATTEMPTS: '5',
    MC_RECONNECT_BASE_DELAY_MS: '1000',
    MC_RECONNECT_MAX_DELAY_MS: '10000',
    MC_RECONNECT_RESET_AFTER_MS: '45000'
  })
  assert.equal(config.host, '192.168.1.20')
  assert.equal(config.port, 60000)
  assert.equal(config.username, 'helper')
  assert.equal(config.owner, 'steve')
  assert.equal(config.followDistance, 3.5)
  assert.equal(config.statusIntervalMs, 0)
  assert.equal(config.reconnectAttempts, 5)
})

test('loadConfig rejects invalid ports', () => {
  for (const port of ['0', '65536', 'abc', '12.5']) {
    assert.throws(() => loadConfig({ MC_PORT: port }), /MC_PORT must be an integer/)
  }
})

test('loadConfig pins the protocol version to 26.1', () => {
  assert.equal(loadConfig({ MC_PORT: '54321' }).version, '26.1')
  assert.equal(loadConfig({ MC_PORT: '54321', MC_VERSION: '26.1' }).version, '26.1')
  for (const version of ['26.1.2', '26.2', '1.21.4']) {
    assert.throws(
      () => loadConfig({ MC_PORT: '54321', MC_VERSION: version }),
      /MC_VERSION is fixed to '26\.1'/
    )
  }
})

test('loadConfig rejects a bot name equal to the owner', () => {
  assert.throws(
    () => loadConfig({ MC_PORT: '54321', MC_USERNAME: 'asche_v', MC_OWNER: 'asche_v' }),
    /must differ/
  )
  assert.throws(
    () => loadConfig({ MC_PORT: '54321', MC_USERNAME: 'Asche_V', MC_OWNER: 'asche_v' }),
    /must differ/
  )
})

test('loadConfig rejects an out-of-range follow distance', () => {
  assert.throws(() => loadConfig({ MC_PORT: '54321', MC_FOLLOW_DISTANCE: '0' }), /MC_FOLLOW_DISTANCE/)
  assert.throws(() => loadConfig({ MC_PORT: '54321', MC_FOLLOW_DISTANCE: '17' }), /MC_FOLLOW_DISTANCE/)
})

test('loadConfig rejects a max reconnect delay below the base delay', () => {
  assert.throws(
    () => loadConfig({ MC_PORT: '54321', MC_RECONNECT_BASE_DELAY_MS: '5000', MC_RECONNECT_MAX_DELAY_MS: '1000' }),
    /must be greater than or equal/
  )
})
