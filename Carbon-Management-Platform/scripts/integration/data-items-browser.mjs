import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

// Synthetic records and screenshots remain in the disposable database/tmpdir.
export async function verifyDataItemsBrowser({ baseURL, adminCookie }) {
  const artifacts = mkdtempSync(join(tmpdir(), "carbon-data-items-"));
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
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      errors.push(message.text());
  });
  page.setDefaultTimeout(15_000);
  const dialog = () => page.getByRole("dialog");
  const itemRow = (code = "SYN_UI_ITEM") =>
    page.getByRole("row").filter({ hasText: code });
  const details = () => page.getByRole("dialog", { name: "公共数据项详情" });
  async function submit(name, status) {
    const [response] = await Promise.all([
      page.waitForResponse(
        (result) =>
          result.url().includes("/api/admin/data-items") &&
          result.request().method() !== "GET",
      ),
      dialog().getByRole("button", { name, exact: true }).click(),
    ]);
    assert.equal(response.status(), status);
    await dialog().waitFor({ state: "hidden" });
  }
  try {
    await page.goto(baseURL + "/admin/data-items");
    await page.getByRole("heading", { name: "公共数据项库" }).waitFor();
    await page.getByRole("button", { name: "新增数据项", exact: true }).click();
    await dialog()
      .getByRole("button", { name: "保存草稿", exact: true })
      .click();
    await dialog().getByText("请填写数据项编码", { exact: true }).waitFor();
    await dialog().getByText("请填写数据名称", { exact: true }).waitFor();
    await dialog()
      .getByLabel("数据项编码", { exact: true })
      .fill("SYN_UI_ITEM");
    await dialog()
      .getByLabel("数据名称", { exact: true })
      .fill("SYN 界面验证柴油");
    await submit("保存草稿", 201);
    await itemRow().getByText("v1 草稿", { exact: true }).waitFor();

    await itemRow()
      .getByRole("button", { name: /编\s*辑/ })
      .click();
    await dialog().getByLabel("规格型号", { exact: true }).fill("UI-SYN-01");
    await submit("保存草稿", 200);
    await itemRow().getByText("UI-SYN-01", { exact: true }).waitFor();

    await itemRow()
      .getByRole("button", { name: /发\s*布/ })
      .click();
    await dialog()
      .getByRole("button", { name: "校验并发布", exact: true })
      .click();
    await dialog()
      .getByText("发布前请选择活动数据单位", { exact: true })
      .waitFor();
    await dialog().getByLabel("活动数据单位", { exact: true }).click();
    await dialog().getByLabel("活动数据单位", { exact: true }).fill("升");
    await page
      .locator(".ant-select-dropdown")
      .getByText("升 (L)", { exact: true })
      .click();
    await dialog()
      .getByLabel("排放因子数值（可选）", { exact: true })
      .fill("2 kgCO2e/L");
    await dialog()
      .getByRole("button", { name: "校验并发布", exact: true })
      .click();
    await dialog()
      .getByText("仅填写有限数值，单位由活动数据单位生成", { exact: true })
      .waitFor();
    await dialog()
      .getByLabel("排放因子数值（可选）", { exact: true })
      .fill("2.68");
    await dialog()
      .getByLabel("因子来源", { exact: true })
      .fill("SYN 界面验证来源");
    await dialog().getByText("单位：kgCO₂e/L", { exact: true }).waitFor();
    await page.screenshot({
      path: join(artifacts, "publish-form.png"),
      fullPage: true,
    });
    await submit("校验并发布", 200);
    await itemRow().getByText("v1", { exact: true }).waitFor();

    await itemRow()
      .getByRole("button", { name: "创建新版本", exact: true })
      .click();
    assert.equal(
      await dialog()
        .getByLabel("排放因子数值（可选）", { exact: true })
        .inputValue(),
      "2.68",
    );
    await dialog()
      .getByLabel("排放因子数值（可选）", { exact: true })
      .fill("2.9");
    await submit("保存草稿", 201);
    await itemRow().getByText("v2 草稿", { exact: true }).waitFor();
    await itemRow().getByText("v1", { exact: true }).waitFor();
    assert.equal(await itemRow().count(), 1);
    await page.screenshot({
      path: join(artifacts, "data-item-with-draft.png"),
      animations: "disabled",
      fullPage: true,
    });
    await itemRow()
      .getByRole("button", { name: /^查\s*看$/ })
      .click();
    await details().getByText("2.68 kgCO₂e/L", { exact: true }).waitFor();
    await details().locator(".ant-drawer-close").click();
    await dialog().waitFor({ state: "hidden" });

    await itemRow()
      .getByRole("button", { name: /停\s*用/ })
      .click();
    await dialog()
      .getByRole("button", { name: "确认停用", exact: true })
      .click();
    await dialog().getByText("请填写停用原因", { exact: true }).waitFor();
    await dialog()
      .getByLabel("停用原因", { exact: true })
      .fill("SYN 界面验证停用原因");
    await submit("确认停用", 200);
    await itemRow().getByText("已停用", { exact: true }).waitFor();
    await page.screenshot({
      path: join(artifacts, "version-list.png"),
      fullPage: true,
    });

    await page.getByPlaceholder("名称、编码、规格或厂家").fill("SYN_NOT_FOUND");
    await page.getByRole("button", { name: /搜\s*索/ }).click();
    await page.getByText("没有符合筛选条件的数据项", { exact: true }).waitFor();
    await page.getByRole("button", { name: /重\s*置/ }).click();
    await itemRow().getByText("已停用", { exact: true }).waitFor();
    await itemRow().getByRole("button", { name: "历史版本（1）" }).click();
    const retiredHistory = page.getByRole("dialog", {
      name: "SYN 界面验证柴油 · 历史版本",
    });
    await retiredHistory
      .getByText("SYN 界面验证停用原因", { exact: true })
      .waitFor();
    await retiredHistory.getByText("2.68 kgCO₂e/L", { exact: true }).waitFor();
    await retiredHistory.getByRole("button", { name: /^查\s*看$/ }).click();
    await details().getByText("该版本已停用", { exact: true }).waitFor();
    await details().locator(".ant-drawer-close").click();
    await details().waitFor({ state: "hidden" });
    await retiredHistory.locator(".ant-drawer-close").click();
    await retiredHistory.waitFor({ state: "hidden" });
    await itemRow()
      .getByRole("button", { name: /发\s*布/ })
      .click();
    await submit("校验并发布", 200);
    await itemRow().getByText("v2", { exact: true }).waitFor();
    await itemRow()
      .getByRole("button", { name: "历史版本（1）" })
      .waitFor({ state: "hidden" });
    await page
      .getByText("1 个从未被引用的旧版本已删除", { exact: true })
      .waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "Library page must not overflow the viewport",
    );
    await page.screenshot({
      path: join(artifacts, "mobile-list.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(
      baseURL + "/admin/data-items?q=SYNC_&status=RETIRED&pageSize=1",
    );
    await page.getByText("共 2 个数据项", { exact: true }).waitFor();
    await itemRow("SYNC_B").getByText("v3", { exact: true }).waitFor();
    await itemRow("SYNC_A").waitFor({ state: "hidden" });
    await page.locator(".ant-pagination-item-2").click();
    await itemRow("SYNC_A").getByText("v3", { exact: true }).waitFor();
    await itemRow("SYNC_B").waitFor({ state: "hidden" });

    await page.goto(baseURL + "/admin/data-items?q=SYNC_");
    await itemRow("SYNC_A")
      .getByRole("button", { name: "历史版本（2）" })
      .waitFor();
    await itemRow("SYNC_B")
      .getByRole("button", { name: "历史版本（2）" })
      .waitFor();
    await page.screenshot({
      path: join(artifacts, "grouped-list.png"),
      animations: "disabled",
      fullPage: true,
    });
    await itemRow("SYNC_B")
      .getByRole("button", { name: "历史版本（2）" })
      .click();
    const groupedHistory = page.getByRole("dialog", {
      name: "SYNC 钢材 · 历史版本",
    });
    await groupedHistory
      .getByText("共 2 个历史版本", { exact: true })
      .waitFor();
    assert.deepEqual(
      await groupedHistory
        .getByRole("cell", { name: /^v[12]$/ })
        .allTextContents(),
      ["v2", "v1"],
    );
    await page.screenshot({
      path: join(artifacts, "grouped-history.png"),
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
          browserErrors: errors,
          checks: [
            "required-fields",
            "draft-save",
            "draft-edit",
            "publish-unit-validation",
            "numeric-factor-validation",
            "new-version",
            "frozen-v1",
            "retirement-reason",
            "unused-retired-version-cleanup",
            "current-and-draft-in-one-row",
            "same-name-different-codes",
            "grouped-pagination-and-history-filter",
            "history-drawer-details",
            "search",
            "reset",
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
    console.error("Data item browser evidence: " + artifacts);
    throw error;
  } finally {
    await browser.close();
  }
  console.log("Data item browser evidence: " + artifacts);
}
