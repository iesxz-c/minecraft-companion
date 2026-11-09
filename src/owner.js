'use strict'

function findPlayerByName (bot, name) {
  if (!bot || !bot.players || !name) return null
  const target = name.toLowerCase()
  for (const [username, player] of Object.entries(bot.players)) {
    if (username.toLowerCase() === target) return player || null
  }
  return null
}

function resolveOwnerEntity (bot, ownerName) {
  const player = findPlayerByName(bot, ownerName)
  if (player && player.entity) return player.entity

  if (!bot || !bot.entities || !ownerName) return null
  const target = ownerName.toLowerCase()
  for (const entity of Object.values(bot.entities)) {
    if (!entity || entity.type !== 'player') continue
    const username = entity.username || entity.name
    if (typeof username === 'string' && username.toLowerCase() === target) return entity
  }
  return null
}

function formatDistance (distance) {
  if (!Number.isFinite(distance)) return 'unknown distance'
  return `${distance.toFixed(1)} blocks`
}

function buildStatusMessage ({ owner, ownerVisible, distance, following, inventoryStacks = 0 }) {
  if (!ownerVisible) return `Waiting for ${owner} to be visible.`
  const activity = following ? 'Following' : 'Near'
  return `${activity} ${owner} (${formatDistance(distance)}). Inventory: ${inventoryStacks} stacks.`
}

module.exports = { findPlayerByName, resolveOwnerEntity, formatDistance, buildStatusMessage }
