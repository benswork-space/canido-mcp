# @canido/mcp-server

MCP server for **[CanIDo](https://canido-api-production.up.railway.app)** — the regulatory intelligence API that answers: *"What permits, licenses, or regulations apply if I want to do X at location Y?"*

Give any MCP-compatible AI agent (Claude Desktop, Cursor, Continue, etc.) the ability to look up structured permit requirements for food service businesses in:

- 🤠 **Austin, TX**
- 🌉 **San Francisco, CA**
- 🗽 **New York City, NY**

## Installation

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "canido": {
      "command": "npx",
      "args": ["-y", "@canido/mcp-server"],
      "env": {
        "CANIDO_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Get a free API key at [canido-api-production.up.railway.app](https://canido-api-production.up.railway.app) (10 queries/month, no credit card required).

### Cursor / Continue / other MCP clients

Any MCP-compatible client will work. Point them at:

```
command: npx
args: ["-y", "@canido/mcp-server"]
env:
  CANIDO_API_KEY: your_api_key
```

## Tools

### `lookup_requirements`
Look up permits, licenses, and regulatory requirements for a business activity in a specific location.

**Parameters:**
- `activity`: `food_truck` | `restaurant` | `catering` | `cottage_food`
- `location`: `austin_tx` | `san_francisco_ca` | `new_york_city_ny`
- `category` (optional): `health` | `fire` | `zoning` | `building` | `alcohol` | `tax` | `business_registration` | `certification`

### `list_locations`
Get all supported locations.

### `get_requirement_detail`
Get detailed info about a specific requirement by ID.

## Example

Ask Claude:

> "What do I need to open a food truck in Austin?"

Claude will call `lookup_requirements` and come back with structured data: permits, fees, agencies, processing times, prerequisites, and common gotchas.

## Pricing

- **Free**: 10 queries/month
- **Starter**: $49/mo — 500 queries/month
- **Pro**: $199/mo — 5,000 queries/month + bulk lookups + regulatory change webhooks
- **Enterprise**: Custom

## License

MIT
