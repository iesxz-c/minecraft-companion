# Minecraft Companion

An autonomous Minecraft companion bot for a local LAN survival world. **Phase 1 / Milestone 1 only:** connect, find the owner, and follow them. It does not mine, chop trees, collect items, or modify the world yet.

Built with Node.js and [Mineflayer](https://github.com/PrismarineJS/mineflayer). Deterministic behavior only — no LLM.

## Requirements

- Node.js **22 or newer** (verified on Node 26.13.0)
- Minecraft Java Edition **26.1.x** (verified on 26.1.2). The bot pins the protocol to `26.1`, which 26.1.2 uses too.
- The world opened to LAN (`Esc` → **Open to LAN**)
- Java 25 is bundled with the game. You do **not** need to install Java for this bot.

## Setup

```bash
npm install
```

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and set `MC_PORT` to the port shown in Minecraft chat when you open the world to LAN. The port changes every session, so update it each time.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `MC_HOST` | `127.0.0.1` | LAN server address |
| `MC_PORT` | **required** | LAN port from the “Open to LAN” chat message |
| `MC_USERNAME` | `asche_companion` | Bot username; must differ from the owner |
| `MC_OWNER` | `asche_v` | Human player to follow |
| `MC_VERSION` | `26.1` (fixed) | Pinned protocol version. Do not set it; any other value is rejected |
| `MC_FOLLOW_DISTANCE` | `2` | Follow range in blocks |
| `MC_STATUS_INTERVAL_MS` | `30000` | Chat/log status interval; `0` disables periodic status |
| `MC_RECONNECT_ATTEMPTS` | `3` | Consecutive reconnect attempts before giving up; `0` disables reconnect |
| `MC_RECONNECT_BASE_DELAY_MS` | `2000` | First reconnect delay |
| `MC_RECONNECT_MAX_DELAY_MS` | `30000` | Backoff cap |
| `MC_RECONNECT_RESET_AFTER_MS` | `60000` | Reset the reconnect counter after this much stable uptime |

The bot uses offline authentication (`auth: 'offline'`), which matches the non-premium TLauncher/LAN setup. The protocol version is pinned in code to `26.1`; it is not meant to be configured. Minecraft 26.1 and 26.1.2 share protocol 775, so running the 26.1.2 client is fine.

## Run

```bash
MC_PORT=54321 npm start
```

Or with the `.env` file:

```bash
npm run start:env
```

On a successful connection the bot:

1. Waits for chunks to load.
2. Finds `MC_OWNER` (case-insensitive).
3. Starts a dynamic `GoalFollow` at `MC_FOLLOW_DISTANCE`.
4. Reports its status in Minecraft chat and the terminal.
5. Reconnects with exponential backoff if the connection drops, up to `MC_RECONNECT_ATTEMPTS`.

Stop it with `Ctrl+C`.

## Testing

Unit tests use Node's built-in test runner and do not need a Minecraft server:

```bash
npm test
```

Manual integration check (requires a running LAN world):

1. Open the world to LAN and copy the port.
2. Start the bot with `MC_PORT=<port> npm start`.
3. Confirm the bot joins and says it is looking for you in chat.
4. Walk around; confirm it follows and keeps roughly 2 blocks of distance.
5. Temporarily close the LAN world or stop the server; confirm the bot reports the disconnect and retries with increasing delays.
6. Restart the LAN world with the same port and confirm the bot reconnects (if attempts remain).

## Safety and scope

- The pathfinder is configured with `canDig = false`, no pillaring, and no scaffolding blocks. M1 cannot break or place blocks.
- The bot never writes to `~/.minecraft/saves/`, `servers.dat`, or any other game file. It only reads the world through the Minecraft protocol.
- No mining, woodcutting, item collection, or combat yet.
- No LLM or external service calls.
- The owner must be visible in the same dimension for following to start.

## Troubleshooting

**`unsupported protocol version` / connection rejected immediately**
The bot always sends `26.1`. If you set `MC_VERSION` to anything else (including `26.1.2`), configuration fails before connecting. Remove `MC_VERSION` from your environment; Minecraft 26.1.2 clients work because they share protocol 775 with 26.1.

**`ECONNREFUSED`**
The `MC_PORT` is stale or the LAN world is not open. Re-open LAN and use the new port.

**Bot joins but never follows**
Check that `MC_OWNER` exactly matches the in-game username (case-insensitive matching is supported), and that you are in the same dimension. Look for “Waiting for … to be visible” in chat.

**Bot gives up reconnecting**
Increase `MC_RECONNECT_ATTEMPTS`, or restart the bot after re-opening LAN. Reconnect attempts are consecutive failures; long stable connections reset the counter.

**The bot cannot reach you**
The pathfinder refuses to dig or pillar by design. If you are behind blocks or across a gap, it will report that it cannot reach you. This is intentional for M1.
