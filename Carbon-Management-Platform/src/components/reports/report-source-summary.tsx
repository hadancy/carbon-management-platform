"use client";
import Link from "next/link";
import { Alert, Card, Descriptions, Listy } from "antd";
import { displayReportNumber } from "@/domain/reports/document";
import type { ReportSource } from "@/domain/reports/snapshot";

export function ReportSourceSummary({
  source,
  templateVersion,
  templateSnapshot,
}: {
  source: ReportSource;
  templateVersion: string;
  templateSnapshot?:
    import("@/shared/report-template").PublicTemplateSnapshot | null;
}) {
  return (
    <div className="space-y-3">
      {(source.demonstration ||
        templateSnapshot?.content.purpose === "TEST") && (
        <Alert
          type="warning"
          showIcon
          title="DEMO / TEST 演示案例：构造数据仅用于流程验收，预览与导出均保留此标记。"
        />
      )}
      <Card size="small" title="固定核算来源">
        <Descriptions
          size="small"
          column={{ xs: 1, md: 2 }}
          items={[
            {
              key: "case",
              label: "核算案例",
              children: (
                <Link href={"/accounting/" + source.accountingCase.id}>
                  {source.accountingCase.code +
                    " · v" +
                    source.accountingCase.revisionNo}
                </Link>
              ),
            },
            {
              key: "product",
              label: "产品 / 项目",
              children: source.accountingCase.product,
            },
            {
              key: "emissions",
              label: "排放总量",
              children:
                displayReportNumber(
                  source.result.display.totalEmissionsKg,
                  source.result.display.totalBelowDisplayPrecision,
                  "0.01",
                ) + " kgCO₂e",
            },
            {
              key: "footprint",
              label: "单位电量碳足迹",
              children:
                displayReportNumber(
                  source.result.display.footprintKgPerKwh,
                  source.result.display.belowDisplayPrecision,
                  "0.000001",
                ) + " kgCO₂e/kWh",
            },
            {
              key: "run",
              label: "固定运行",
              children: (
                <span className="break-all text-xs">{source.run.id}</span>
              ),
            },
            {
              key: "template",
              label: "报告模板",
              children: templateSnapshot
                ? `${templateSnapshot.title} · ${templateSnapshot.code} v${templateSnapshot.version}（${templateSnapshot.content.purpose === "TEST" ? "测试" : "正式"}） / ${templateVersion}`
                : `内置模板 / ${templateVersion}`,
            },
          ]}
        />
      </Card>
      {!!source.snapshot.assets.length && (
        <Card size="small" title="本校证据附件">
          <Listy
            items={source.snapshot.assets}
            rowKey="id"
            itemRender={(asset) => (
              <a
                href={"/api/files/" + asset.id}
                target="_blank"
                rel="noreferrer"
              >
                {asset.name}
              </a>
            )}
          />
        </Card>
      )}
    </div>
  );
}
