import "dotenv/config";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import pg from "pg";
import { chromium } from "playwright";
const origin = new URL(process.env.BETTER_AUTH_URL ?? "");
assert.equal(
  origin.protocol,
  "https:",
  "Deployment requires the configured HTTPS origin",
);
assert.ok(
  origin.hostname !== "carbon.example.edu",
  "Set the actual deployment domain",
);
assert.ok(
  (process.env.BETTER_AUTH_SECRET ?? "").length >= 32 &&
    !/replace|example|ci_only/i.test(process.env.BETTER_AUTH_SECRET),
  "Set a deployment secret with at least 32 characters",
);
assert.ok(
  existsSync("public/fonts/NotoSansSC-Regular.otf"),
  "Report font is missing",
);
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
await client.connect();
try {
  const { rows } = await client.query(
    'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name',
  );
  assert.ok(
    rows.some(
      (row) => row.migration_name === "20261008010000_public_report_templates",
    ),
    "Apply the latest schema migration before promotion",
  );
  await client.query(
    'SELECT "templateSnapshot" FROM "FootprintReport" LIMIT 0',
  );
} finally {
  await client.end();
}
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PDF_BROWSER_EXECUTABLE
    ? { executablePath: process.env.PDF_BROWSER_EXECUTABLE }
    : {}),
});
try {
  const page = await browser.newPage();
  await page.setContent("<p>PDF deployment check</p>");
  assert.ok((await page.pdf()).length > 1000);
} finally {
  await browser.close();
}
console.log(
  "Deployment configuration, migrated database, font and Chromium checks passed",
);
