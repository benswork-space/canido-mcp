#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.CANIDO_API_URL || "https://canido-api-production.up.railway.app";
const API_KEY = process.env.CANIDO_API_KEY || "";

const VALID_ACTIVITIES = [
  "food_truck",
  "mobile_food_vendor",
  "restaurant",
  "catering",
  "cottage_food",
  "home_food",
] as const;

const VALID_LOCATIONS = [
  "austin_tx",
  "san_francisco_ca",
  "new_york_city_ny",
] as const;

async function apiGet(path: string): Promise<any> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Accept": "application/json",
  };
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }

  const resp = await fetch(url, { headers });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`CanIDo API error ${resp.status}: ${body}`);
  }

  return resp.json();
}

function formatRequirement(req: any): string {
  const lines: string[] = [];

  lines.push(`## ${req.name}`);
  if (req.description) lines.push(req.description);
  lines.push("");

  // Agency
  lines.push(`**Issuing Agency:** ${req.agency.name}`);
  if (req.agency.url) lines.push(`**Agency URL:** ${req.agency.url}`);
  if (req.agency.phone) lines.push(`**Phone:** ${req.agency.phone}`);

  // Fee
  if (req.fee.amount !== null) {
    let feeStr = `$${req.fee.amount}`;
    if (req.fee.amount_max && req.fee.amount_max !== req.fee.amount) {
      feeStr += ` - $${req.fee.amount_max}`;
    }
    if (req.fee.basis) feeStr += ` (${req.fee.basis})`;
    lines.push(`**Fee:** ${feeStr}`);
  } else if (req.fee.basis === "free") {
    lines.push("**Fee:** Free");
  }

  // Fee tiers
  if (req.fee.tiers && req.fee.tiers.length > 0) {
    lines.push("**Fee Tiers:**");
    for (const tier of req.fee.tiers) {
      const label = tier.label || `Up to $${tier.threshold}`;
      lines.push(`  - ${label}: $${tier.amount}`);
    }
  }

  // Processing time
  if (req.processing_time.min_days !== null) {
    const min = req.processing_time.min_days;
    const max = req.processing_time.max_days;
    if (max && max !== min) {
      lines.push(`**Processing Time:** ${min}-${max} days`);
    } else {
      lines.push(`**Processing Time:** ${min} days`);
    }
  }

  // Application URL
  if (req.application_url) {
    lines.push(`**Apply:** ${req.application_url}`);
  }

  // Code references
  if (req.code_references && req.code_references.length > 0) {
    lines.push(`**Code References:** ${req.code_references.join("; ")}`);
  }

  // Renewal
  if (req.renewal.frequency_months) {
    let renewStr = `Every ${req.renewal.frequency_months} months`;
    if (req.renewal.fee) renewStr += ` ($${req.renewal.fee})`;
    lines.push(`**Renewal:** ${renewStr}`);
  }

  // Supply constraints
  if (req.supply_constraints) {
    lines.push(`**Supply:** ${req.supply_constraints.type}`);
    if (req.supply_constraints.total_available) {
      lines.push(`**Total Available:** ${req.supply_constraints.total_available}`);
    }
    if (req.supply_constraints.notes) {
      lines.push(`**Note:** ${req.supply_constraints.notes}`);
    }
  }

  // Prerequisites
  if (req.prerequisites && req.prerequisites.length > 0) {
    lines.push(`**Prerequisites:** ${req.prerequisites.join(", ")}`);
  }

  // Gotchas
  if (req.common_gotchas && req.common_gotchas.length > 0) {
    lines.push("**Important Notes:**");
    for (const g of req.common_gotchas) {
      lines.push(`  - ${g}`);
    }
  }

  // Freshness
  if (req.freshness) {
    lines.push(`**Data Freshness:** ${req.freshness.score}/100 (verified: ${req.freshness.last_verified?.split("T")[0] || "unknown"})`);
  }

  return lines.join("\n");
}

// Create MCP server
const server = new McpServer({
  name: "canido",
  version: "0.1.0",
});

// Tool: lookup requirements
server.tool(
  "lookup_requirements",
  "Look up what permits, licenses, and regulatory requirements are needed for a business activity in a specific location. Returns detailed requirements including fees, agencies, processing times, prerequisites, and common gotchas.",
  {
    activity: z.enum(VALID_ACTIVITIES).describe(
      "Business type to look up requirements for"
    ),
    location: z.enum(VALID_LOCATIONS).describe(
      "Location to check requirements in"
    ),
    category: z
      .string()
      .optional()
      .describe(
        "Optional filter by category: health, fire, zoning, building, alcohol, tax, business_registration, certification"
      ),
  },
  async ({ activity, location, category }) => {
    let path = `/v1/requirements?activity=${activity}&location=${location}`;
    if (category) path += `&category=${category}`;

    const data = await apiGet(path);

    const locationNames: Record<string, string> = {
      austin_tx: "Austin, TX",
      san_francisco_ca: "San Francisco, CA",
      new_york_city_ny: "New York City, NY",
    };

    const activityNames: Record<string, string> = {
      food_truck: "Food Truck / Mobile Food Vendor",
      mobile_food_vendor: "Food Truck / Mobile Food Vendor",
      restaurant: "Restaurant (Brick & Mortar)",
      catering: "Catering Business",
      cottage_food: "Home-Based / Cottage Food",
      home_food: "Home-Based / Cottage Food",
    };

    let output = `# Permit Requirements: ${activityNames[activity] || activity} in ${locationNames[location] || location}\n\n`;
    output += `**Total requirements found:** ${data.total}\n\n`;

    // Group by jurisdiction level
    const levels = ["federal", "state", "city"];
    for (const level of levels) {
      const reqs = data.requirements.filter(
        (r: any) => r.jurisdiction_level === level
      );
      if (reqs.length === 0) continue;

      output += `---\n# ${level.charAt(0).toUpperCase() + level.slice(1)}-Level Requirements\n\n`;

      for (const req of reqs) {
        output += formatRequirement(req) + "\n\n";
      }
    }

    // Add any remaining levels (county, etc.)
    const covered = new Set(levels);
    const remaining = data.requirements.filter(
      (r: any) => !covered.has(r.jurisdiction_level)
    );
    if (remaining.length > 0) {
      output += `---\n# Other Requirements\n\n`;
      for (const req of remaining) {
        output += formatRequirement(req) + "\n\n";
      }
    }

    output += `\n---\n*Data provided by CanIDo (canido.dev). Freshness scores indicate data reliability. This is not legal advice — verify with official sources before acting.*`;

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// Tool: list locations
server.tool(
  "list_locations",
  "List all locations (cities) currently supported by CanIDo for regulatory lookups.",
  {},
  async () => {
    const data = await apiGet("/v1/locations");

    let output = "# Supported Locations\n\n";
    output += "CanIDo currently covers food service business requirements in:\n\n";
    for (const loc of data.locations) {
      output += `- **${loc.name}** (${loc.state}) — use location ID: \`${loc.id}\`\n`;
    }
    output += "\n**Supported business types:** food_truck, restaurant, catering, cottage_food\n";

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// Tool: get single requirement detail
server.tool(
  "get_requirement_detail",
  "Get detailed information about a specific permit or requirement by its ID.",
  {
    requirement_id: z.string().describe("The requirement ID (e.g., 'austin_mobile_food_vendor_permit')"),
  },
  async ({ requirement_id }) => {
    const req = await apiGet(`/v1/requirements/${requirement_id}`);
    const output = formatRequirement(req);

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
