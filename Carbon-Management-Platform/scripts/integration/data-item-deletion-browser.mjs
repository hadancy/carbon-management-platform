import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";

export async function verifyDataItemDeletionBrowser({
  baseURL,
  adminCookie,
  entries,
  makeReferenced,
}) {
  const artifacts = mkdtempSync(join(tmpdir(), "carbon-data-item-delete-"));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies(
    adminCookie
      .split(";")
      .filter(Boolean)
      .map((entry) => {
        const [name, ...value] = entry.trim().split("=");
        return { name, value: value.join("="), url: baseURL };
      }),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  const expectedConflictUrl = `${baseURL}/api/admin/data-items/${entries.race.id}`;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (!["warning", "error"].includes(message.type())) return;
    if (
      message.location().url === expectedConflictUrl &&
      /409/.test(message.text())
    )
      return;
    errors.push(message.text());
  });
  const row = (entry) => page.getByRole("row").filter({ hasText: entry.code });
  const dialog = () => page.getByRole("dialog");
  async function open(entry) {
    await row(entry)
      .getByRole("button", { name: /删\s*除/ })
      .click();
    await dialog().getByText(entry.dataName, { exact: true }).waitFor();
  }
  async function confirm(entry, status) {
    const result = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/admin/data-items/${entry.id}`) &&
        response.request().method() === "DELETE",
    );
    await dialog()
      .getByRole("button", { name: "确认删除", exact: true })
      .click();
    assert.equal((await result).status(), status);
  }
  try {
    await page.goto(baseURL + "/admin/data-items?q=DELETE_UI_");
    await page.getByRole("heading", { name: "公共数据项库" }).waitFor();
    assert.equal(
      await row(entries.used)
        .getByRole("button", { name: /删\s*除/ })
        .isDisabled(),
      true,
    );
    await row(entries.used)
      .getByRole("button", { name: /停\s*用/ })
      .waitFor();
    await open(entries.draft);
    await dialog()
      .getByRole("button", { name: /取\s*消/ })
      .click();
    await dialog().waitFor({ state: "hidden" });
    await row(entries.draft).waitFor();
    await open(entries.draft);
    await confirm(entries.draft, 200);
    await dialog().waitFor({ state: "hidden" });
    await row(entries.draft).waitFor({ state: "detached" });
    await open(entries.free);
    await page.screenshot({
      path: join(artifacts, "delete-confirmation.png"),
      animations: "disabled",
      fullPage: true,
    });
    await confirm(entries.free, 200);
    await dialog().waitFor({ state: "hidden" });
    await row(entries.free).waitFor({ state: "detached" });
    await open(entries.race);
    await makeReferenced();
    await confirm(entries.race, 409);
    await dialog()
      .getByText(
        "该版本已被模型引用（包括历史和已移除的引用），只能停用，不能删除",
        { exact: true },
      )
      .waitFor();
    await dialog()
      .getByRole("button", { name: /取\s*消/ })
      .click();
    await dialog().waitFor({ state: "hidden" });
    await page.reload();
    assert.equal(
      await row(entries.race)
        .getByRole("button", { name: /删\s*除/ })
        .isDisabled(),
      true,
    );
    await page.screenshot({
      path: join(artifacts, "referenced-protected.png"),
      animations: "disabled",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    writeFileSync(
      join(artifacts, "result.json"),
      JSON.stringify(
        {
          status: "PASSED",
          unexpectedBrowserErrors: errors,
          checks: [
            "draft-delete",
            "confirmation-cancel",
            "unreferenced-publication-delete",
            "referenced-delete-disabled",
            "stale-page-server-conflict",
            "retire-remains-available",
            "390px-no-overflow",
          ],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await page
      .screenshot({ path: join(artifacts, "failure.png"), fullPage: true })
      .catch(() => {});
    writeFileSync(
      join(artifacts, "failure.txt"),
      `${error}\n${errors.join("\n")}\n${await page
        .locator("body")
        .innerText()
        .catch(() => "")}`,
    );
    console.error("Data item deletion browser evidence: " + artifacts);
    throw error;
  } finally {
    await browser.close();
  }
  console.log("Data item deletion browser evidence: " + artifacts);
}
