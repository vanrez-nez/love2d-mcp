# love2d-mcp

> **Model Context Protocol server for the [LÖVE 2D](https://love2d.org/) game framework API**

Gives AI assistants (Claude, Gemini, Copilot, Cursor, etc.) accurate, searchable access to the full **LÖVE 12.0 API** — directly inside the tools they already use.

---


## What it offers

### Tools

| Tool | Description |
|------|-------------|
| `love2d_search_docs` | Full-text fuzzy search across all API symbols. Returns ranked matches. |
| `love2d_lookup_symbol` | Full documentation for a specific symbol — signatures, args, returns, examples. |
| `love2d_update_docs` | Check for and download the latest docs from GitHub. |

### Resources

URI template `docs://love2d/{module}/{symbol}` — browse documentation pages directly by URI.

### Prompts

`explain_api` — template that asks the model to explain a specific LÖVE API with examples.

---

## Installation

### Requirements

- Node.js **≥ 18**

### Clone and install

```bash
git clone --recurse-submodules https://github.com/vanrez-nez/love2d-mcp.git
cd love2d-mcp
npm install   # also runs postinstall: tries to fetch latest docs, falls back to bundle
npm run build
```

> `postinstall` will attempt to download the latest docs DB from GitHub. If you are offline it exits cleanly and uses the bundled snapshot.

---

## Configure your AI client

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "love2d": {
      "command": "node",
      "args": ["/absolute/path/to/love2d-mcp/dist/index.js"]
    }
  }
}
```

### VS Code (GitHub Copilot / Continue / etc.)

Add to `.vscode/mcp.json` in your project, or to your user `settings.json`:

```json
{
  "mcp": {
    "servers": {
      "love2d": {
        "type": "stdio",
        "command": "node",
        "args": ["/absolute/path/to/love2d-mcp/dist/index.js"]
      }
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "love2d": {
      "command": "node",
      "args": ["/absolute/path/to/love2d-mcp/dist/index.js"]
    }
  }
}
```

---

## Usage examples

Once configured, just ask naturally in chat:

> *"How do I play a looping audio track in LÖVE?"*
> *"Show me the signature for love.graphics.draw"*
> *"What physics body types exist?"*
> *"How do I handle keyboard input in LÖVE 12?"*

The AI will automatically call `love2d_search_docs` or `love2d_lookup_symbol` as needed.

### Keeping docs up to date

Ask the AI: *"Update the Love2D docs"* — or call the tool directly:

```
love2d_update_docs({ force: false })
```

The updated database is cached locally; the server reloads it on the next restart.

---

## Development

```bash
npm run dev          # tsx watch — auto-reloads on src changes
npm run inspect      # opens MCP Inspector in browser for manual testing
npm run build        # sync data/ from submodule + compile TypeScript
npm run sync-data    # manually copy latest submodule dist → data/
```


### Update flow

```
npm install
  └── postinstall → try GitHub fetch → cache to .love2d-mcp-cache/
                                     → if fails: use bundled data/

MCP server first tool call
  └── lazy-load from cache (if present) or data/ (bundle)
        └── fire-and-forget background check → update cache for next restart

love2d_update_docs tool
  └── explicit update + immediate in-memory reload
```

---

## Data sources

The bundled database merges:

| Source | Records |
|--------|---------|
| [`love2d-community/love-api`](https://github.com/love2d-community/love-api) | Low-level API (arguments, signatures) |
| [LÖVE wiki snapshot](https://love2d.org/wiki) | High-level docs, examples, notes |

Database maintained at [`vanrez-nez/love2d-docs-search`](https://github.com/vanrez-nez/love2d-docs-search).

---

## License

MIT
