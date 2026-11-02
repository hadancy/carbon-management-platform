import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

export async function verifyModelDataItemsBrowser({
  baseURL,
  schoolCookie,
  modelId,
  versionId,
}) {
  const artifacts = mkdtempSync(join(tmpdir(), "carbon-model-data-items-"));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies(
    schoolCookie
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
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      errors.push(message.text());
  });
  const dialog = () => page.getByRole("dialog");
  const pickerRow = (code) =>
    dialog().getByRole("row").filter({ hasText: code });
  const modelRow = (code) => page.getByRole("row").filter({ hasText: code });
  async function search(query) {
    await dialog()
      .locator("button.ant-btn-loading")
      .waitFor({ state: "hidden" });
    await dialog().getByPlaceholder("名称、编码、规格或厂家").fill(query);
    const loaded = page.waitForResponse(
      (response) =>
        response.url().includes("/api/data-items?") &&
        new URL(response.url()).searchParams.get("q") === query,
    );
    await dialog()
      .getByRole("button", { name: /搜\s*索/ })
      .click();
    assert.equal((await loaded).status(), 200);
  }
  async function save() {
    const response = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/model-versions/${versionId}`) &&
        response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    const result = await response;
    assert.equal(result.status(), 200, await result.text());
    await page.getByText("修改已保存", { exact: true }).waitFor();
    return (await result.json()).version.content;
  }
  try {
    await page.goto(`${baseURL}/models/${modelId}/versions/${versionId}`);
    await page.getByText("生命周期阶段与数据项", { exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "新增数据项", exact: true })
        .count(),
      0,
    );
    await page
      .getByRole("button", { name: "从公共库选择", exact: true })
      .click();
    await search("PICK_ITEM_");
    await pickerRow("PICK_ITEM_12").getByRole("checkbox").check();
    await pickerRow("PICK_ITEM_11").getByRole("checkbox").check();
    await dialog().locator(".ant-pagination-item-2").click();
    await pickerRow("PICK_ITEM_02").getByRole("checkbox").check();
    await dialog().getByText("已选择 3 个数据项", { exact: true }).waitFor();
    await page.screenshot({
      path: join(artifacts, "cross-page-selection.png"),
      fullPage: true,
    });
    await dialog()
      .getByRole("button", { name: "添加所选数据项（3）", exact: true })
      .click();
    await dialog().waitFor({ state: "hidden" });
    const original = await save();
    const originalItems = original.stages[0].categories[0].items;
    assert.equal(originalItems.length, 3);
    const originalId = originalItems.find(
      (item) => item.librarySource.code === "PICK_ITEM_12",
    ).id;

    await page
      .getByRole("button", { name: "从公共库选择", exact: true })
      .click();
    await search("PICK_ITEM_12");
    assert.equal(
      await pickerRow("PICK_ITEM_12").getByRole("checkbox").isDisabled(),
      true,
    );
    await dialog()
      .getByRole("button", { name: /取\s*消/ })
      .click();
    await dialog().waitFor({ state: "hidden" });

    await modelRow("PICK_ITEM_12")
      .getByRole("button", { name: /更\s*换/ })
      .click();
    await search("PICK_ITEM_03");
    await pickerRow("PICK_ITEM_03").getByRole("radio").check();
    await dialog()
      .getByRole("button", { name: "确认更换", exact: true })
      .click();
    await dialog().waitFor({ state: "hidden" });
    const replaced = await save();
    const changed = replaced.stages[0].categories[0].items.find(
      (item) => item.librarySource.code === "PICK_ITEM_03",
    );
    assert.equal(changed.id, originalId);
    assert.equal(changed.factorSource, "REF 因子来源");
    await page.screenshot({
      path: join(artifacts, "model-references.png"),
      fullPage: true,
    });

    await page
      .getByRole("button", { name: "从公共库选择", exact: true })
      .click();
    await search("NO_SUCH_PUBLIC_ITEM");
    await dialog()
      .getByText("没有符合条件的公共数据项，请调整搜索或联系平台管理员补充。", {
        exact: true,
      })
      .waitFor();
    await dialog()
      .getByRole("button", { name: /取\s*消/ })
      .click();
    await dialog().waitFor({ state: "hidden" });
    await modelRow("PICK_ITEM_11")
      .getByRole("button", { name: /移\s*除/ })
      .click();
    await page.getByRole("button", { name: /确\s*定/ }).click();
    const removed = await save();
    assert.equal(removed.stages[0].categories[0].items.length, 2);
    await page.reload();
    await modelRow("PICK_ITEM_03")
      .getByText("PICK_ITEM_03 v1", { exact: true })
      .waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: "从公共库选择", exact: true })
      .click();
    await search("PICK_ITEM_");
    await pickerRow("PICK_ITEM_12").waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "Picker must not overflow the mobile viewport",
    );
    await page.screenshot({
      path: join(artifacts, "mobile-picker.png"),
      fullPage: false,
    });
    assert.deepEqual(errors, []);
    writeFileSync(
      join(artifacts, "result.json"),
      JSON.stringify(
        {
          status: "PASSED",
          browserErrors: errors,
          checks: [
            "library-only-entry",
            "search",
            "cross-page-selection",
            "save-and-reload",
            "duplicate-disabled",
            "replace-stable-id",
            "missing-item-guidance",
            "remove-occurrence",
            "390px-picker",
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
    console.error("Model item picker evidence: " + artifacts);
    throw error;
  } finally {
    await browser.close();
  }
  console.log("Model item picker evidence: " + artifacts);
}
