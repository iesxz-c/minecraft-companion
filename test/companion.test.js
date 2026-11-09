'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { formatReason, formatPosition } = require('../src/companion')

test('formatReason handles strings, errors, and unknown values', () => {
  assert.equal(formatReason('server closed'), 'server closed')
  assert.equal(formatReason(new Error('boom')), 'boom')
  assert.equal(formatReason(null), 'connection closed')
  assert.equal(formatReason({ message: 'object message' }), 'object message')
})

test('formatPosition rounds to one decimal place', () => {
  assert.equal(formatPosition({ x: 1.234, y: -60, z: 9.876 }), '1.2, -60.0, 9.9')
})
