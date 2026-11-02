import assert from "node:assert/strict";
import type { setupPvDemo } from "./pv-setup";
import { db } from "../../src/server/db/prisma";
import {
  createReport,
  createReportRevision,
  saveReportDraft,
} from "../../src/server/reports/drafts";
import { transitionReport } from "../../src/server/reports/review";
import { getReport } from "../../src/server/reports/queries";
import { reportPdfFile } from "../../src/server/reports/exports";
import { parseReportSource } from "../../src/domain/reports/snapshot";
import { defaultReportContent } from "../../src/domain/reports/document";
import { RequestError } from "../../src/server/http/response";

type Demo = Awaited<ReturnType<typeof setupPvDemo>>;
export async function runReportDemo(
  demo: Demo,
  code: string,
  caseCode: string,
  reportingDate: string,
) {
  let report = await db.footprintReport.findUnique({
    where: { schoolId_code: { schoolId: demo.schoolA.id, code } },
  });
  const reused = !!report;
  if (!report) {
    const run = await db.calculationRun.findFirst({
      where: {
        schoolId: demo.schoolA.id,
        mode: "PRODUCTION",
        revision: { status: "APPROVED", case: { code: caseCode } },
        reviews: { some: { decision: "APPROVE" } },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!run)
      throw new Error("未找到指定演示案例的已审核运行，请先运行 demo:pv");
    report = await createReport(demo.writer.principal, demo.writer.context, {
      code,
      calculationRunId: run.id,
    });
    const source = parseReportSource(report.sourceSnapshot);
    const firstContent = {
      ...defaultReportContent(source, demo.writer.principal.displayName),
      reportingDate,
      conclusion:
        "DEMO：该结果来自已审核的构造光伏运行；本版供复核并演示驳回修订。",
    };
    let first = await db.reportRevision.findUniqueOrThrow({
      where: { id: report.currentRevisionId! },
    });
    const request = (revision: typeof first) => ({
      revisionId: revision.id,
      expectedContentRevision: revision.contentRevision,
    });
    first = await saveReportDraft(
      demo.writer.principal,
      demo.writer.context,
      report.id,
      { ...request(first), content: firstContent },
    );
    await transitionReport(
      demo.writer.principal,
      demo.writer.context,
      report.id,
      "submit",
      request(first),
    );
    await assert.rejects(
      transitionReport(
        demo.writer.principal,
        demo.writer.context,
        report.id,
        "review",
        { ...request(first), decision: "APPROVE", reason: "DEMO 自审" },
      ),
      (error: unknown) => error instanceof RequestError && error.status === 403,
    );
    await transitionReport(
      demo.reviewer.principal,
      demo.reviewer.context,
      report.id,
      "review",
      {
        ...request(first),
        decision: "REJECT",
        reason: "DEMO：请补充对展示精度和演示数据用途的说明。",
      },
    );
    let second = await createReportRevision(
      demo.writer.principal,
      demo.writer.context,
      report.id,
      request(first),
    );
    second = await saveReportDraft(
      demo.writer.principal,
      demo.writer.context,
      report.id,
      {
        ...request(second),
        content: {
          ...firstContent,
          conclusion:
            "DEMO：排放总量与单位电量碳足迹按已审核运行的展示值记录。完整原始精度保留在附录；此构造案例仅用于报告流程验收，不代表真实电站。",
        },
      },
    );
    await transitionReport(
      demo.writer.principal,
      demo.writer.context,
      report.id,
      "submit",
      request(second),
    );
    await transitionReport(
      demo.reviewer.principal,
      demo.reviewer.context,
      report.id,
      "review",
      {
        ...request(second),
        decision: "APPROVE",
        reason:
          "DEMO：正文、固定核算结果与引用版本核对一致，通过演示流程复核。",
      },
    );
    await createReportRevision(
      demo.writer.principal,
      demo.writer.context,
      report.id,
      request(second),
    );
  }
  const entry = await getReport(demo.schoolA.id, report.id);
  const source = parseReportSource(entry.sourceSnapshot);
  if (source.accountingCase.code !== caseCode)
    throw new Error("演示报告编号已绑定其他案例，请使用新 DEMO_ 编号");
  const first = entry.revisions.find((revision) => revision.revisionNo === 1);
  const approved = entry.revisions.find(
    (revision) => revision.revisionNo === 2,
  );
  assert.equal(first?.status, "REJECTED");
  assert.equal(approved?.status, "APPROVED");
  assert.ok(approved);
  const run = await db.calculationRun.findUniqueOrThrow({
    where: { id: entry.calculationRunId },
  });
  assert.deepEqual(source.result, run.result);
  const before = JSON.stringify(entry.sourceSnapshot);
  const pdf = await reportPdfFile(
    demo.writer.principal,
    demo.writer.context,
    approved.id,
    true,
  );
  const repeated = await reportPdfFile(
    demo.writer.principal,
    demo.writer.context,
    approved.id,
    true,
  );
  assert.equal(pdf.file.id, repeated.file.id);
  assert.equal(pdf.file.fileHash, repeated.file.fileHash);
  await assert.rejects(
    getReport(demo.schoolB.id, entry.id),
    (error: unknown) => error instanceof RequestError && error.status === 404,
  );
  await assert.rejects(
    reportPdfFile(
      demo.outsider.principal,
      demo.outsider.context,
      approved.id,
      false,
    ),
    (error: unknown) => error instanceof RequestError && error.status === 404,
  );
  assert.equal(
    JSON.stringify((await getReport(demo.schoolA.id, entry.id)).sourceSnapshot),
    before,
  );
  return {
    pdf: pdf.file.content,
    result: {
      schemaVersion: 1,
      checkedAt: new Date().toISOString(),
      scope: "T07_DEMO_REPORT",
      status: "PASSED",
      execution: reused ? "REUSED_HISTORY" : "CREATED_AND_VERIFIED",
      reportId: entry.id,
      reportCode: code,
      reportPath: "/reports/" + entry.id,
      schoolId: demo.schoolA.id,
      calculationRunId: entry.calculationRunId,
      caseCode,
      revisions: entry.revisions.map((revision) => ({
        id: revision.id,
        number: revision.revisionNo,
        status: revision.status,
        contentHash: revision.contentHash,
      })),
      display: source.result.display,
      pdfRevision: 2,
      pdfFileHash: pdf.file.fileHash,
      checks: [
        "已审核 DEMO 运行绑定",
        "正文编辑提交",
        "禁止自审",
        "独立复核驳回",
        "新修订通过",
        "旧版冻结",
        "修订 v3 草稿体验",
        "PDF 重复导出同一文件",
        "跨校报告及PDF下载拒绝",
        "来源数值与核算一致",
      ],
    },
  };
}
