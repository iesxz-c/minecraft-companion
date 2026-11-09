# AGENTS.md

## Status: M1 implemented — M2 not started

Milestone 1 (connect + follow) is implemented and unit-tested. Do **not** add mining, woodcutting, item collection, combat, or inventory management without explicit approval. Implement one milestone at a time and wait for approval between milestones.

## Project

Autonomous Minecraft companion written in JavaScript/Node.js with **Mineflayer**. It coexists with the human player (`asche_v`) in their LAN survival world. Deterministic behavior only — **no LLM dependency** in Phase 1.

Current bot: connects offline, waits for chunks, finds the owner, follows with `GoalFollow`, reports status in chat, and reconnects with bounded backoff.

## Verified environment (2026-11-09)

- Node **v26.13.0**, npm **11.20.0**. Mineflayer 4.39.0 requires Node >= 22.
- Minecraft Java **26.1.2** via TLauncher, vanilla, local world `New World`.
- The game runs its bundled **Java 25** at `~/.minecraft/runtime/java-runtime-epsilon/linux/...`; system `java` is 27 and irrelevant to Mineflayer. Do not launch the game with system Java.
- TLauncher account is non-premium/offline. The bot uses `auth: 'offline'` and `asche_companion`.
- The LAN port is random per session. **M1 requires manual `MC_PORT`**; automatic port discovery from `~/.minecraft/logs/latest.log` is not implemented yet. Never hardcode 25565 or coordinates.

## Compatibility — the non-obvious part

Verified by running stock packages against a throwaway 26.1.2 server:

- **Use `version: '26.1'`, never `version: '26.1.2'`.** 26.1 and 26.1.2 share protocol 775. Mineflayer's `testedVersions` has `26.1` but not `26.1.2`; passing `26.1.2` throws `unsupported protocol version`. The version is pinned as `PROTOCOL_VERSION` in `src/config.js`. `MC_VERSION` is optional and only accepted when it equals `26.1`; anything else fails config validation. Do not make the version freely configurable.
- `mineflayer@4.39.0` + `minecraft-data@3.119.0`: login, spawn, chat, block updates, inventory pickup all work.
- `mineflayer-pathfinder@2.4.5`: `GoalFollow` works for following a real player entity.
- `mineflayer-collectblock@1.6.0` (not used yet): works **only through the promise API**. The callback form throws `Cannot read properties of undefined (reading 'chestLocations')`. Use `await bot.collectBlock.collect(block, options)`.
- `mineflayer-tool@1.2.0` (not used yet): loads and `bot.tool.equipForBlock()` works, but pass real `prismarine-item` instances; plain `{ id, count }` objects break creative inventory calls.
- `spawn` fires **before chunks load**. Always `await bot.waitForChunksToLoad()` before `bot.blockAt` / `findBlock` / digging, or lookups return `null` and `bot.dig` can hang forever. `bot.health` / `bot.food` can also be `undefined` on the first spawn tick; wait a beat.
- Survival `bot.dig` works. Creative-mode digging hung in testing — do not use creative as a proxy for mining behavior.
- Mineflayer has no support for 26.2/26.3 yet. Do not "fix" a connection by changing the client version.

## M1 implementation notes

- `src/companion.js` owns the bot lifecycle: connect, spawn setup, follow, status, disconnect, reconnect.
- Pathfinder is deliberately read-only: `canDig = false`, `allow1by1towers = false`, `scafoldingBlocks = []`. Do not relax these in M1.
- `createBot()` passes `hideErrors: true`; errors are handled through the `error`, `kicked`, and `end` events to avoid duplicate stack traces.
- Reconnect is bounded: exponential backoff (2×) plus up to 20% jitter, capped by `MC_RECONNECT_MAX_DELAY_MS`. The counter resets after `MC_RECONNECT_RESET_AFTER_MS` of stable uptime. `MC_RECONNECT_ATTEMPTS=0` disables reconnect.
- The protocol version is pinned to `26.1` in `src/config.js`. `.env.example` no longer sets `MC_VERSION`; setting it to anything other than `26.1` is a configuration error.
- Owner lookup is case-insensitive: `bot.players` first, then `bot.entities` with `type === 'player'`.
- A 10-second follow-retry loop runs independently of periodic status chat. `MC_STATUS_INTERVAL_MS=0` disables chat spam but not following.
- 22 unit tests pass with `npm test`. M1 was also verified end-to-end with two bots against a throwaway 26.1.2 server (follow distance settled around 2–4 blocks).

## Hard rules

- Never modify `~/.minecraft/saves/`, `servers.dat`, or other game files. Reading `logs/latest.log` is allowed.
- No hardcoded coordinates. Derive positions from `bot.entity.position`, player entities, and block scans.
- No destructive action without explicit authorization: breaking player-placed blocks, killing mobs, dropping or consuming items, placing lava/water/TNT. M1 should not place or break blocks at all.
- No LLM calls, no remote services, no telemetry.
- Keep the protocol version pinned to `26.1`. Do not add a config option that lets it drift to `26.1.2`, `26.2`, or anything else.
- Keep modules small and single-purpose: perception, navigation, inventory, behaviors, safety, state machine (add these only when their milestone is approved).

## Layout

```text
src/
  index.js          entrypoint: config -> Companion -> signal handling
  config.js         env parsing and validation
  companion.js      connection, spawn setup, follow, status, reconnect
  owner.js          case-insensitive owner/player resolution + status text
  reconnect.js      backoff calculation + attempt policy
test/
  *.test.js         unit tests, built-in node:test, no server required
```

Use CommonJS (`require`) — Mineflayer and its plugins are CJS. Do not add another test framework.

## Commands

```bash
npm install
npm start                       # requires MC_PORT
npm run start:env               # reads .env (copy .env.example)
npm test                        # unit tests; no Minecraft server needed
MC_PORT=54321 npm start         # connect to the LAN world
```

Do not add a default `MC_PORT`; it changes every LAN session. Integration checks must use a separate/throwaway server on another port, never the live survival world by default.

## Roadmap

1. **M1 — connect + follow** — implemented. Pending validation in the user's real LAN world.
2. **M2 — item collection** (not started; needs approval): dropped-item pickup, inventory capacity, return-to-owner command.
3. **M3 — tree chopping**: locate logs, reachability/failure handling, tool selection.
4. **M4 — ore mining**: coal/iron/copper targets, tool tiers, drop pickup.
5. **M5 — safety**: lava/cliffs/void/mobs, stuck detection, abort/report.
6. **M6 — hardening**: tests, failure injection, docs.

## Remaining real-world validation

- Confirm the LAN server accepts offline auth on the actual world.
- Confirm the owner username and behavior on real terrain. Since the pathfinder cannot dig or pillar, it may report `noPath` around obstacles; this is expected for M1.
- Confirm the manual `MC_PORT` workflow. Automatic LAN-log parsing is a possible later improvement, not part of M1.
