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
  const row = (version) =>
    page
      .getByRole("row")
      .filter({ hasText: "SYN_UI_ITEM" })
      .filter({ has: page.getByText(`v${version}`, { exact: true }) });
  async function submit(name, status) {
    const response = page.waitForResponse(
      (result) =>
        result.url().includes("/api/admin/data-items") &&
        result.request().method() !== "GET",
    );
    await dialog().getByRole("button", { name, exact: true }).click();
    assert.equal((await response).status(), status);
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
    await row(1).getByText("草稿", { exact: true }).waitFor();

    await row(1)
      .getByRole("button", { name: /编\s*辑/ })
      .click();
    await dialog().getByLabel("规格型号", { exact: true }).fill("UI-SYN-01");
    await submit("保存草稿", 200);
    await row(1).getByText("UI-SYN-01", { exact: true }).waitFor();

    await row(1)
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
    await row(1).getByText("已发布", { exact: true }).waitFor();

    await row(1)
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
    await row(2).getByText("草稿", { exact: true }).waitFor();
    await row(1)
      .getByRole("button", { name: /查\s*看/ })
      .click();
    await dialog().getByText("2.68 kgCO₂e/L", { exact: true }).waitFor();
    await page.locator(".ant-drawer-close").click();
    await dialog().waitFor({ state: "hidden" });

    await row(1)
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
    await row(1).getByText("已停用", { exact: true }).waitFor();
    await page.screenshot({
      path: join(artifacts, "version-list.png"),
      fullPage: true,
    });

    await page.getByPlaceholder("名称、编码、规格或厂家").fill("SYN_NOT_FOUND");
    await page.getByRole("button", { name: /搜\s*索/ }).click();
    await page.getByText("没有符合筛选条件的数据项", { exact: true }).waitFor();
    await page.getByRole("button", { name: /重\s*置/ }).click();
    await row(1).getByText("已停用", { exact: true }).waitFor();
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
