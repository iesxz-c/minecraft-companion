'use strict'

const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const { GoalFollow } = goals
const { createReconnectPolicy } = require('./reconnect')
const { resolveOwnerEntity, buildStatusMessage } = require('./owner')

function createDefaultLogger () {
  const prefix = () => `${new Date().toISOString()} [companion]`
  return {
    info: (...args) => console.log(prefix(), ...args),
    warn: (...args) => console.warn(prefix(), ...args),
    error: (...args) => console.error(prefix(), ...args)
  }
}

function formatReason (reason) {
  if (reason === undefined || reason === null) return 'connection closed'
  if (typeof reason === 'string') return reason
  if (typeof reason.message === 'string') return reason.message
  try {
    return String(reason)
  } catch {
    return 'unknown reason'
  }
}

class Companion {
  constructor ({
    config,
    logger = createDefaultLogger(),
    createBot = mineflayer.createBot,
    timers = { setTimeout, clearTimeout, setInterval, clearInterval },
    random = Math.random,
    onGiveUp = () => {}
  }) {
    this.config = config
    this.logger = logger
    this.createBot = createBot
    this.timers = timers
    this.random = random
    this.onGiveUp = onGiveUp

    this.bot = null
    this.started = false
    this.stopped = false
    this.reconnectTimer = null
    this.statusTimer = null
    this.stableTimer = null
    this.retryTimer = null
    this.followTarget = null
    this.pathfinderReady = false
    this.lastError = null
    this.lastNoPathAt = 0

    this.policy = createReconnectPolicy({
      maxAttempts: config.reconnectAttempts,
      baseDelayMs: config.reconnectBaseDelayMs,
      maxDelayMs: config.reconnectMaxDelayMs,
      random
    })
  }

  start () {
    if (this.started) return
    this.started = true
    this.stopped = false
    this.connect()
  }

  stop () {
    this.stopped = true
    this.clearAllTimers()
    const bot = this.bot
    this.bot = null
    if (bot) {
      try {
        bot.quit('Companion shutting down')
      } catch (err) {
        this.logger.warn(`Could not quit cleanly: ${err.message}`)
      }
    }
  }

  connect () {
    if (this.stopped) return
    this.reconnectTimer = null
    this.lastError = null
    this.followTarget = null
    this.pathfinderReady = false

    const { host, port, username, version } = this.config
    this.logger.info(`Connecting to ${host}:${port} as ${username} (Minecraft ${version}, offline auth)`)

    let bot
    try {
      bot = this.createBot({
        host,
        port,
        username,
        auth: 'offline',
        version,
        hideErrors: true
      })
    } catch (err) {
      this.logger.error(`Could not create bot: ${err.message}`)
      this.giveUp()
      return
    }

    this.bot = bot
    bot.loadPlugin(pathfinder)
    this.attachHandlers(bot)
  }

  attachHandlers (bot) {
    bot.once('spawn', () => {
      this.onSpawn(bot).catch((err) => {
        if (bot === this.bot) this.logger.error(`Spawn setup failed: ${err.message}`)
      })
    })

    bot.on('error', (err) => {
      this.lastError = err
      this.logger.error(`Bot error: ${err.message}`)
    })

    bot.on('kicked', (reason) => {
      this.logger.warn(`Kicked: ${formatReason(reason)}`)
    })

    bot.on('end', (reason) => {
      this.onEnd(bot, reason)
    })

    bot.on('playerJoined', (player) => {
      if (player && player.username && player.username.toLowerCase() === this.config.owner.toLowerCase()) {
        this.logger.info(`Owner ${this.config.owner} joined.`)
        this.startFollowing(bot)
      }
    })

    bot.on('playerLeft', (player) => {
      if (player && player.username && player.username.toLowerCase() === this.config.owner.toLowerCase()) {
        this.onOwnerLeft(bot)
      }
    })

    bot.on('path_update', (result) => {
      if (!result || result.status !== 'noPath') return

      this.followTarget = null
      try {
        bot.pathfinder.stop()
      } catch (err) {
        this.logger.warn(`Could not stop pathfinder after noPath: ${err.message}`)
      }
      this.scheduleFollowRetry(bot)

      const now = Date.now()
      if (now - this.lastNoPathAt < 15000) return
      this.lastNoPathAt = now
      this.logger.warn(`No path to ${this.config.owner}; retrying in 10s.`)
      this.say(bot, `I can't reach ${this.config.owner} right now.`)
    })
  }

  async onSpawn (bot) {
    if (bot !== this.bot || this.stopped) return

    const position = bot.entity && bot.entity.position
    this.logger.info(`Spawned${position ? ` at ${formatPosition(position)}` : ''}.`)

    this.clearStableTimer()
    this.stableTimer = this.timers.setTimeout(() => {
      this.stableTimer = null
      if (bot !== this.bot || this.stopped) return
      this.policy.reset()
      this.logger.info('Connection stable; reconnect counter reset.')
    }, this.config.reconnectResetAfterMs)

    try {
      await bot.waitForChunksToLoad()
      this.logger.info('Chunks loaded.')
    } catch (err) {
      if (bot !== this.bot) return
      this.logger.warn(`Could not wait for chunks: ${err.message}`)
    }

    if (bot !== this.bot || this.stopped) return

    this.setupPathfinder(bot)
    this.say(bot, `${this.config.username} online. Looking for ${this.config.owner}.`)
    if (!this.startFollowing(bot)) this.scheduleFollowRetry(bot)
    this.startStatusLoop(bot)
  }

  setupPathfinder (bot) {
    const movements = new Movements(bot)
    // M1 must never change the world: no digging, no pillaring, no scaffolding.
    movements.canDig = false
    movements.allow1by1towers = false
    movements.scafoldingBlocks = []
    movements.canOpenDoors = true
    bot.pathfinder.setMovements(movements)
    this.pathfinderReady = true
    this.logger.info('Pathfinder ready (digging and block placement disabled).')
  }

  startFollowing (bot) {
    if (bot !== this.bot || this.stopped || !bot.entity || !this.pathfinderReady) return false

    const ownerEntity = resolveOwnerEntity(bot, this.config.owner)
    if (!ownerEntity) {
      if (this.followTarget) {
        this.followTarget = null
        try {
          bot.pathfinder.stop()
        } catch (err) {
          this.logger.warn(`Could not stop pathfinder: ${err.message}`)
        }
      }
      return false
    }

    if (this.followTarget === ownerEntity) return true

    try {
      bot.pathfinder.setGoal(new GoalFollow(ownerEntity, this.config.followDistance), true)
      this.followTarget = ownerEntity
      this.logger.info(`Following ${this.config.owner} at ${this.config.followDistance} blocks.`)
      this.say(bot, `Following ${this.config.owner}.`)
      return true
    } catch (err) {
      this.logger.warn(`Could not start following ${this.config.owner}: ${err.message}`)
      return false
    }
  }

  scheduleFollowRetry (bot) {
    if (this.retryTimer || this.stopped) return
    this.retryTimer = this.timers.setTimeout(() => {
      this.retryTimer = null
      if (bot !== this.bot || this.stopped) return
      if (!this.startFollowing(bot)) this.scheduleFollowRetry(bot)
    }, 10000)
  }

  onOwnerLeft (bot) {
    if (bot !== this.bot) return
    this.followTarget = null
    this.logger.info(`Owner ${this.config.owner} left.`)
    if (this.pathfinderReady) {
      try {
        bot.pathfinder.stop()
      } catch (err) {
        this.logger.warn(`Could not stop pathfinder: ${err.message}`)
      }
    }
    this.say(bot, `Waiting for ${this.config.owner}.`)
  }

  startStatusLoop (bot) {
    this.clearStatusTimer()
    if (this.config.statusIntervalMs === 0) {
      this.logger.info('Periodic status chat disabled (MC_STATUS_INTERVAL_MS=0).')
      return
    }

    this.statusTimer = this.timers.setInterval(() => {
      if (bot !== this.bot || this.stopped || !bot.entity) return

      this.startFollowing(bot)
      const ownerEntity = resolveOwnerEntity(bot, this.config.owner)
      const ownerVisible = Boolean(ownerEntity)
      const distance = ownerVisible ? bot.entity.position.distanceTo(ownerEntity.position) : Infinity
      const following = ownerVisible && this.followTarget === ownerEntity
      const inventoryStacks = bot.inventory && typeof bot.inventory.items === 'function'
        ? bot.inventory.items().length
        : 0

      const message = buildStatusMessage({
        owner: this.config.owner,
        ownerVisible,
        distance,
        following,
        inventoryStacks
      })
      this.logger.info(message)
      this.say(bot, message)
    }, this.config.statusIntervalMs)
  }

  onEnd (bot, reason) {
    if (bot !== this.bot) return
    this.bot = null
    this.followTarget = null
    this.pathfinderReady = false
    this.clearBotTimers()

    if (this.stopped) return

    const detail = (reason === undefined || reason === null) && this.lastError
      ? this.lastError.message
      : formatReason(reason)
    this.logger.warn(`Disconnected: ${detail}`)
    this.scheduleReconnect()
  }

  scheduleReconnect () {
    if (this.stopped) return
    if (!this.policy.canRetry()) {
      this.logger.error(`Reconnect limit reached (${this.config.reconnectAttempts} attempts). Giving up.`)
      this.giveUp()
      return
    }

    const delay = this.policy.nextDelay()
    this.logger.warn(`Reconnect attempt ${this.policy.attempts}/${this.config.reconnectAttempts} in ${delay}ms.`)
    this.reconnectTimer = this.timers.setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  giveUp () {
    this.stopped = true
    this.clearAllTimers()
    this.onGiveUp()
  }

  say (bot, message) {
    if (!bot || bot !== this.bot) return
    try {
      bot.chat(message)
    } catch (err) {
      this.logger.warn(`Chat failed: ${err.message}`)
    }
  }

  clearStatusTimer () {
    if (this.statusTimer) {
      this.timers.clearInterval(this.statusTimer)
      this.statusTimer = null
    }
  }

  clearStableTimer () {
    if (this.stableTimer) {
      this.timers.clearTimeout(this.stableTimer)
      this.stableTimer = null
    }
  }

  clearBotTimers () {
    this.clearStatusTimer()
    this.clearStableTimer()
    if (this.retryTimer) {
      this.timers.clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  clearAllTimers () {
    this.clearBotTimers()
    if (this.reconnectTimer) {
      this.timers.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}

function formatPosition (position) {
  return `${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`
}

module.exports = { Companion, formatReason, formatPosition, createDefaultLogger }
