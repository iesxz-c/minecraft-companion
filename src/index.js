'use strict'

const { loadConfig } = require('./config')
const { Companion } = require('./companion')

function main () {
  let config
  try {
    config = loadConfig(process.env)
  } catch (err) {
    console.error(`Configuration error: ${err.message}`)
    process.exitCode = 1
    return
  }

  const companion = new Companion({
    config,
    onGiveUp: () => {
      process.exitCode = 1
    }
  })

  let shuttingDown = false
  function shutdown (signal) {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`${new Date().toISOString()} [companion] Received ${signal}; shutting down.`)
    companion.stop()
  }

  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.on('unhandledRejection', (err) => {
    console.error(`${new Date().toISOString()} [companion] Unhandled rejection:`, err)
  })

  companion.start()
}

if (require.main === module) main()

module.exports = { main }
