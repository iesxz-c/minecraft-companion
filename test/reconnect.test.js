'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { nextReconnectDelay, createReconnectPolicy } = require('../src/reconnect')

test('nextReconnectDelay grows exponentially without jitter', () => {
  const options = { baseDelayMs: 2000, maxDelayMs: 30000, random: () => 0 }
  assert.equal(nextReconnectDelay(1, options), 2000)
  assert.equal(nextReconnectDelay(2, options), 4000)
  assert.equal(nextReconnectDelay(3, options), 8000)
  assert.equal(nextReconnectDelay(4, options), 16000)
})

test('nextReconnectDelay caps at maxDelayMs', () => {
  const options = { baseDelayMs: 2000, maxDelayMs: 30000, random: () => 0 }
  assert.equal(nextReconnectDelay(5, options), 30000)
  assert.equal(nextReconnectDelay(20, options), 30000)
})

test('nextReconnectDelay jitter stays within 20% and never exceeds maxDelayMs', () => {
  const options = { baseDelayMs: 2000, maxDelayMs: 30000, random: () => 1 }
  assert.equal(nextReconnectDelay(1, options), 2400)
  assert.equal(nextReconnectDelay(20, options), 30000)
})

test('nextReconnectDelay rejects a non-positive attempt', () => {
  assert.throws(() => nextReconnectDelay(0, { baseDelayMs: 1000, maxDelayMs: 5000 }), /positive integer/)
})

test('reconnect policy stops at maxAttempts and can be reset', () => {
  const policy = createReconnectPolicy({
    maxAttempts: 3,
    baseDelayMs: 2000,
    maxDelayMs: 30000,
    random: () => 0
  })

  assert.equal(policy.canRetry(), true)
  assert.equal(policy.nextDelay(), 2000)
  assert.equal(policy.attempts, 1)
  assert.equal(policy.nextDelay(), 4000)
  assert.equal(policy.nextDelay(), 8000)
  assert.equal(policy.canRetry(), false)
  assert.equal(policy.nextDelay(), null)

  policy.reset()
  assert.equal(policy.canRetry(), true)
  assert.equal(policy.attempts, 0)
  assert.equal(policy.nextDelay(), 2000)
})

test('reconnect policy with zero attempts never retries', () => {
  const policy = createReconnectPolicy({ maxAttempts: 0, baseDelayMs: 2000, maxDelayMs: 30000, random: () => 0 })
  assert.equal(policy.canRetry(), false)
  assert.equal(policy.nextDelay(), null)
})
