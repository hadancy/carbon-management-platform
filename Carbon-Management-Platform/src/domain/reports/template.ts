import type { ReportDocument, ReportTable } from "./document";

export function escapeReportHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function tableHtml(table: ReportTable) {
  return (
    '<section class="table-section"><h2>' +
    escapeReportHtml(table.title) +
    "</h2><table><thead><tr>" +
    table.columns
      .map((column) => '<th scope="col">' + escapeReportHtml(column) + "</th>")
      .join("") +
    "</tr></thead><tbody>" +
    (table.rows.length
      ? table.rows
          .map(
            (row) =>
              "<tr>" +
              row
                .map((cell) => "<td>" + escapeReportHtml(cell) + "</td>")
                .join("") +
              "</tr>",
          )
          .join("")
      : '<tr><td colspan="' + table.columns.length + '">无记录</td></tr>') +
    "</tbody></table></section>"
  );
}
// Paged-media styles belong to the standalone document, outside the app UI.
export function renderReportHtml(
  document: ReportDocument,
  fontSource = "/fonts/NotoSansSC-Regular.otf",
) {
  const e = escapeReportHtml;
  const notice = document.demonstration
    ? "DEMO / TEST 演示报告：构造数据，仅用于流程验收。"
    : "由校内审核快照生成；不构成第三方认证。";
  return (
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' +
    e(document.title) +
    "</title><style>" +
    '@font-face{font-family:ReportSC;src:url("' +
    fontSource +
    '") format("opentype");font-weight:100 900;font-display:block}' +
    "@page{size:A4;margin:18mm 16mm 18mm}*{box-sizing:border-box}body{font-family:ReportSC,sans-serif;font-size:10pt;line-height:1.6;color:#1e293b;margin:0;background:white}main{max-width:178mm;margin:auto}h1{font-size:24pt;line-height:1.4;color:#16365b;margin:12mm 0 6mm;overflow-wrap:anywhere}h2{font-size:13pt;color:#16365b;line-height:1.5;margin:7mm 0 3mm;break-after:avoid}p{white-space:pre-wrap;overflow-wrap:anywhere;orphans:3;widows:3;margin:2mm 0 5mm}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9pt;line-height:1.5;margin:2mm 0 5mm}thead{display:table-header-group}th,td{border:1px solid #cbd5e1;padding:2.2mm;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}th{text-align:left;background:#eaf0f7;font-weight:bold}tr{break-inside:avoid}.cover{break-after:page}.cover th{width:31%}.eyebrow{font-size:11pt;letter-spacing:1pt;color:#64748b}.notice{border-left:3px solid #b45309;background:#fff7ed;color:#92400e;padding:3mm;margin:5mm 0}.status{font-size:11pt;color:#475569}.digest{font-size:8pt;overflow-wrap:anywhere}.footnote{font-size:8pt;color:#64748b}@media screen{body{background:#eef2f6;padding:20px}main{max-width:210mm;background:white;padding:18mm 16mm;box-shadow:0 2px 15px #0001}.cover{margin-bottom:12mm}}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}main{max-width:none}}" +
    (document.templateVersion === "pv-report-1.0.0"
      ? ".appendix{break-before:page}"
      : ".appendix{margin-top:8mm}") +
    (document.templateVersion === "pv-report-1.0.2"
      ? `h1{font-size:${document.title.length > 60 ? "18" : "20"}pt;text-wrap:balance;line-height:1.5;break-inside:avoid;word-break:normal}`
      : "") +
    '</style></head><body><main><section class="cover"><div class="eyebrow">CARBON FOOTPRINT REPORT / 产品碳足迹报告</div><h1>' +
    e(document.title) +
    '</h1><div class="status">' +
    e(document.code) +
    " · 修订 v" +
    document.revisionNo +
    " · " +
    e(document.statusLabel) +
    '</div><p class="notice">' +
    e(notice) +
    (document.status === "APPROVED" ? "" : " 此修订尚未审核通过，仅供预览。") +
    "</p><table><tbody>" +
    document.metadata
      .map(
        ([label, value]) =>
          '<tr><th scope="row">' +
          e(label) +
          "</th><td>" +
          e(value || "未填写") +
          "</td></tr>",
      )
      .join("") +
    "</tbody></table></section>" +
    tableHtml(document.tables[0]) +
    '<p class="footnote">结果保留快照的展示精度；逐项与原始精度见附录，展示值的舍入可能造成加总差异。正数小于展示精度时用小于号提示。</p>' +
    document.sections
      .map(
        (section) =>
          "<section><h2>" +
          e(section.title) +
          "</h2><p>" +
          e(section.text || "未填写") +
          "</p></section>",
      )
      .join("") +
    "<h2>七、报告复核与冻结记录</h2><p>" +
    e(document.reviewNote) +
    '</p><p class="digest">报告正文与来源摘要 (SHA-256)：' +
    e(document.contentHash) +
    "<br>模板版本：" +
    e(document.templateVersion) +
    '</p><div class="appendix"><h2>附录：数据与版本追溯</h2>' +
    document.tables.slice(1).map(tableHtml).join("") +
    "</div></main></body></html>"
  );
}
