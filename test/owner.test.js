'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  findPlayerByName,
  resolveOwnerEntity,
  formatDistance,
  buildStatusMessage
} = require('../src/owner')

test('findPlayerByName matches case-insensitively', () => {
  const player = { username: 'asche_v', entity: { id: 1 } }
  const bot = { players: { asche_v: player } }
  assert.equal(findPlayerByName(bot, 'ASCHE_V'), player)
  assert.equal(findPlayerByName(bot, 'someone_else'), null)
  assert.equal(findPlayerByName(null, 'asche_v'), null)
})

test('resolveOwnerEntity prefers the player entity', () => {
  const entity = { id: 7, type: 'player', username: 'asche_v' }
  const bot = {
    players: { asche_v: { username: 'asche_v', entity } },
    entities: { 7: entity }
  }
  assert.equal(resolveOwnerEntity(bot, 'asche_v'), entity)
})

test('resolveOwnerEntity falls back to the entity list', () => {
  const entity = { id: 7, type: 'player', username: 'asche_v' }
  const bot = { players: {}, entities: { 7: entity } }
  assert.equal(resolveOwnerEntity(bot, 'asche_v'), entity)
})

test('resolveOwnerEntity ignores non-player entities and unknown owners', () => {
  const bot = {
    players: {},
    entities: {
      1: { id: 1, type: 'mob', username: 'asche_v' },
      2: { id: 2, type: 'player', username: 'other' }
    }
  }
  assert.equal(resolveOwnerEntity(bot, 'asche_v'), null)
})

test('formatDistance handles finite and unknown values', () => {
  assert.equal(formatDistance(2.345), '2.3 blocks')
  assert.equal(formatDistance(Infinity), 'unknown distance')
})

test('buildStatusMessage describes waiting, following, and nearby states', () => {
  assert.equal(
    buildStatusMessage({ owner: 'asche_v', ownerVisible: false, distance: Infinity, following: false }),
    'Waiting for asche_v to be visible.'
  )
  assert.equal(
    buildStatusMessage({ owner: 'asche_v', ownerVisible: true, distance: 2.34, following: true, inventoryStacks: 3 }),
    'Following asche_v (2.3 blocks). Inventory: 3 stacks.'
  )
  assert.equal(
    buildStatusMessage({ owner: 'asche_v', ownerVisible: true, distance: 9, following: false, inventoryStacks: 0 }),
    'Near asche_v (9.0 blocks). Inventory: 0 stacks.'
  )
})
