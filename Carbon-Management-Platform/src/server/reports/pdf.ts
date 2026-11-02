import "server-only";
import { logFailure } from "@/server/http/log";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import type { ReportDocument } from "@/domain/reports/document";
import { renderReportHtml, escapeReportHtml } from "@/domain/reports/template";
import { RequestError } from "@/server/http/response";

let fontData: Promise<string> | undefined;
let active = 0;
export async function renderReportPdf(document: ReportDocument) {
  if (active >= 2) throw new RequestError("PDF 导出繁忙，请稍后重试", 409);
  active++;
  let browser;
  let pdfTimeout: ReturnType<typeof setTimeout> | undefined;
  try {
    fontData ??= readFile(
      path.join(process.cwd(), "public/fonts/NotoSansSC-Regular.otf"),
    )
      .then((content) => "data:font/otf;base64," + content.toString("base64"))
      .catch((error) => {
        fontData = undefined;
        throw error;
      });
    browser = await chromium.launch({
      headless: true,
      timeout: 20000,
      ...(process.env.PDF_BROWSER_EXECUTABLE
        ? { executablePath: process.env.PDF_BROWSER_EXECUTABLE }
        : {}),
    });
    const page = await browser.newPage({ javaScriptEnabled: false });
    // No user supplied URL, script, image or HTML reaches the browser.
    await page.route("**/*", (route) => route.abort());
    await page.emulateMedia({ media: "print" });
    await page.setContent(renderReportHtml(document, await fontData), {
      waitUntil: "load",
      timeout: 20000,
    });
    await page.waitForFunction(
      () => window.document.fonts.status === "loaded",
      undefined,
      { timeout: 20000 },
    );
    const label = escapeReportHtml(
      document.code +
        " / v" +
        document.revisionNo +
        (document.demonstration ? " / DEMO TEST" : ""),
    );
    return await Promise.race([
      page.pdf({
        format: "A4",
        preferCSSPageSize: true,
        printBackground: true,
        tagged: true,
        displayHeaderFooter: true,
        headerTemplate:
          '<div style="font-size:8px;color:#64748b;width:100%;padding:0 16mm;">CARBON FOOTPRINT REPORT - ' +
          label +
          "</div>",
        footerTemplate:
          '<div style="font-size:8px;color:#64748b;width:100%;padding:0 16mm;text-align:right;">' +
          label +
          ' - Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      }),
      new Promise<never>((_, reject) => {
        pdfTimeout = setTimeout(
          () => reject(new Error("PDF generation timed out")),
          20000,
        );
      }),
    ]);
  } catch (error) {
    if (error instanceof RequestError) throw error;
    logFailure("report.pdf.render", error);
    throw new RequestError("PDF 生成失败，请确认浏览器和字体环境后重试", 409);
  } finally {
    clearTimeout(pdfTimeout);
    try {
      await browser?.close();
    } finally {
      active--;
    }
  }
}
