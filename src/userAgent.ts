import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
) as { name: string; version: string };

// Node's global fetch sends no User-Agent by default, which some
// WordPress security plugins/WAFs treat as bot traffic and block with a
// 403 regardless of valid credentials. A normal, identifiable UA avoids
// that without needing any change on the site side.
export const USER_AGENT = `${pkg.name}/${pkg.version}`;
