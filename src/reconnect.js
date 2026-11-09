'use strict'

/**
 * Exponential backoff with up to 20% jitter, capped at maxDelayMs.
 * `attempt` is 1-based: 1 is the first retry.
 */
function nextReconnectDelay (attempt, { baseDelayMs, maxDelayMs, random = Math.random }) {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new RangeError('attempt must be a positive integer')
  }
  const exponential = baseDelayMs * (2 ** (attempt - 1))
  const capped = Math.min(maxDelayMs, exponential)
  const jitter = Math.floor(capped * 0.2 * random())
  return Math.min(maxDelayMs, capped + jitter)
}

function createReconnectPolicy ({ maxAttempts, baseDelayMs, maxDelayMs, random = Math.random }) {
  let attempts = 0

  function canRetry () {
    return attempts < maxAttempts
  }

  function nextDelay () {
    if (!canRetry()) return null
    attempts += 1
    return nextReconnectDelay(attempts, { baseDelayMs, maxDelayMs, random })
  }

  function reset () {
    attempts = 0
  }

  return {
    canRetry,
    nextDelay,
    reset,
    get attempts () { return attempts },
    get maxAttempts () { return maxAttempts }
  }
}

module.exports = { nextReconnectDelay, createReconnectPolicy }
