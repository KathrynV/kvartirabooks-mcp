import { existsSync } from "node:fs";

// Loads local WC_CONSUMER_KEY/WC_CONSUMER_SECRET for the orders integration
// tests, if present. Optional: those tests skip themselves when unset.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
