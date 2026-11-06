# @hub/team-pack

Connects Claude Code to Hub: the `hub` MCP server, `/hub:ask` and `/hub:plan`, and session hooks. Plan: `docs/05` §3.

**The one-step connect is the normal way:** `packages/bridge`, from `pnpm start:local` or the command in Settings › Devices, installs this plugin
and the server with no token to copy. The commands below are the older flow, kept as a fallback for a machine that will not run the bridge. On a device
connected the new way, `link` and `uninstall` point you to the button and the command instead, and `doctor` still works.

```bash
# In Hub: Settings › Tokens › new token. Then, from this repository:
node packages/team-pack/bin/hub.mjs init --token hub_…       # or npx @hub/team-pack, once published
node packages/team-pack/bin/hub.mjs doctor                    # in a new terminal
cd F:/Goteav/backend && node F:/Goteav/hub/packages/team-pack/bin/hub.mjs link goteav
```

| Command                                        | What                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `init [--url http://localhost:7310] --token …` | checks the token, keeps it in user scope, installs the plugin, adds the user-scope `hub` server   |
| `link <slug>`                                  | writes this folder's `.mcp.json`, so a chat here is on that project. It holds no token: commit it |
| `doctor [--flush]`                             | checks everything without a model call; `--flush` sends waiting session reports                   |
| `uninstall`                                    | removes all of it. Linked folders keep their `.mcp.json`                                          |

**Where the token lives.** `~/.hub/config.json` (for hooks) and the user environment variable `HUB_MCP_BEARER` (for Claude
Code). `.mcp.json` has only `Bearer ${HUB_MCP_BEARER}`, which Claude Code expands when connecting. The name avoids
`TOKEN`, since Claude Code blanks some credential-looking names for remote servers.

**Names.** The plugin is `hub`, so skills are `/hub:ask` and `/hub:plan`. It bundles no MCP server, because a plugin's
tools would be named `mcp__plugin_hub_hub__*`; the server is added separately as `hub`, so tools are `mcp__hub__*` and prompts
`/hub:start`, `/hub:next`, `/hub:done`.

**Tests.** `pnpm --filter @hub/team-pack test`. `pnpm --filter @hub/team-pack plugin:validate` runs `claude plugin validate --strict`.
