'use strict'

// Pinned on purpose. Minecraft 26.1 and 26.1.2 share protocol 775, but Mineflayer
// only accepts the '26.1' string. Do not make this configurable: sending any
// other version string is the fastest way to break the connection.
const PROTOCOL_VERSION = '26.1'

const DEFAULTS = Object.freeze({
  host: '127.0.0.1',
  username: 'asche_companion',
  owner: 'asche_v',
  version: PROTOCOL_VERSION,
  followDistance: 2,
  statusIntervalMs: 30000,
  reconnectAttempts: 3,
  reconnectBaseDelayMs: 2000,
  reconnectMaxDelayMs: 30000,
  reconnectResetAfterMs: 60000
})

function readString (env, name, fallback) {
  const value = env[name]
  if (value === undefined || value === null || String(value).trim() === '') return fallback
  return String(value).trim()
}

function readNumber (env, name, fallback, min, max) {
  const raw = env[name]
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a number between ${min} and ${max} (got "${raw}")`)
  }
  return value
}

function readInteger (env, name, fallback, min, max) {
  const raw = env[name]
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max} (got "${raw}")`)
  }
  return value
}

function readVersion (env) {
  const raw = env.MC_VERSION
  if (raw === undefined || raw === null || String(raw).trim() === '') return PROTOCOL_VERSION
  const value = String(raw).trim()
  if (value !== PROTOCOL_VERSION) {
    throw new Error(`MC_VERSION is fixed to '${PROTOCOL_VERSION}'. Minecraft 26.1.2 shares the same protocol, but this bot only ever sends '26.1'; remove MC_VERSION or set it to '26.1'.`)
  }
  return PROTOCOL_VERSION
}

function readPort (env) {
  const raw = env.MC_PORT
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    throw new Error('MC_PORT is required. Open the world to LAN and use the port shown in chat.')
  }
  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`MC_PORT must be an integer between 1 and 65535 (got "${raw}")`)
  }
  return port
}

function loadConfig (env = process.env) {
  const host = readString(env, 'MC_HOST', DEFAULTS.host)
  const username = readString(env, 'MC_USERNAME', DEFAULTS.username)
  const owner = readString(env, 'MC_OWNER', DEFAULTS.owner)
  const version = readVersion(env)

  if (username.toLowerCase() === owner.toLowerCase()) {
    throw new Error('MC_USERNAME must differ from MC_OWNER, otherwise the bot cannot distinguish itself from you.')
  }

  const reconnectBaseDelayMs = readInteger(env, 'MC_RECONNECT_BASE_DELAY_MS', DEFAULTS.reconnectBaseDelayMs, 250, 60000)
  const reconnectMaxDelayMs = readInteger(env, 'MC_RECONNECT_MAX_DELAY_MS', DEFAULTS.reconnectMaxDelayMs, 500, 300000)
  if (reconnectMaxDelayMs < reconnectBaseDelayMs) {
    throw new Error('MC_RECONNECT_MAX_DELAY_MS must be greater than or equal to MC_RECONNECT_BASE_DELAY_MS.')
  }

  return Object.freeze({
    host,
    port: readPort(env),
    username,
    owner,
    version,
    followDistance: readNumber(env, 'MC_FOLLOW_DISTANCE', DEFAULTS.followDistance, 1, 16),
    statusIntervalMs: readInteger(env, 'MC_STATUS_INTERVAL_MS', DEFAULTS.statusIntervalMs, 0, 600000),
    reconnectAttempts: readInteger(env, 'MC_RECONNECT_ATTEMPTS', DEFAULTS.reconnectAttempts, 0, 20),
    reconnectBaseDelayMs,
    reconnectMaxDelayMs,
    reconnectResetAfterMs: readInteger(env, 'MC_RECONNECT_RESET_AFTER_MS', DEFAULTS.reconnectResetAfterMs, 10000, 600000)
  })
}

module.exports = { DEFAULTS, PROTOCOL_VERSION, loadConfig }
