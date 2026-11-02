import type { ReportContent, ReportStatus } from "../../shared/reports";
import { REPORT_STATUS_LABELS } from "../../shared/reports";
import type { PublicTemplateSnapshot } from "../../shared/report-template";
import type { ReportSource } from "./snapshot";

export const REPORT_STAGE_NAMES = {
  RS: "原材料及设备",
  TR: "运输",
  CS: "设施建设",
  US: "生产及退役",
  TD: "输配电",
} as const;
export type ReportTable = {
  title: string;
  columns: string[];
  rows: string[][];
};
export type ReportDocument = {
  title: string;
  code: string;
  revisionNo: number;
  templateVersion: string;
  status: ReportStatus;
  statusLabel: string;
  demonstration: boolean;
  metadata: string[][];
  sections: { title: string; text: string }[];
  tables: ReportTable[];
  contentHash: string;
  reviewNote: string;
};
export function displayReportNumber(
  value: string,
  flag: boolean,
  threshold: string,
) {
  return flag ? "< " + threshold : value;
}
function reportDateTime(value: string, legacy: boolean) {
  return legacy
    ? value.slice(0, 10)
    : new Intl.DateTimeFormat("zh-CN", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(value));
}
export function defaultReportContent(
  source: ReportSource,
  preparedBy: string,
): ReportContent {
  return {
    title: source.accountingCase.product + "碳足迹报告",
    preparedBy,
    reportingDate: "",
    purpose:
      "根据已审核的并网光伏核算运行，说明 1 kWh 输配电后电量的产品碳足迹；分母为总上网电量扣除线损后的交付电量。",
    methodology:
      "采用并网五阶段核算方法。规则依据：" +
      source.snapshot.ruleVersion.content.standardReference +
      "。输配电方法：" +
      (source.snapshot.inputs.transmissionMethod === "GRID_FACTOR_FALLBACK"
        ? "电网因子替代法；" + source.snapshot.inputs.transmissionFallbackReason
        : "SF6 实测法") +
      "。",
    dataQuality: source.demonstration
      ? "DEMO / TEST 构造数据，仅用于工程流程验收；活动量、电量及附件不代表实际电站资料。"
      : "",
    conclusion: "",
    limitations:
      "本报告基于校内审核的核算快照，不构成第三方认证。规则引用、适用期间和对外使用范围须由业务负责人确认。",
  };
}
export function buildReportDocument(
  meta: {
    templateSnapshot?: PublicTemplateSnapshot | null;
    code: string;
    revisionNo: number;
    templateVersion: string;
    status: ReportStatus;
    contentHash: string | null;
    reviewerName: string | null;
    reviewReason: string | null;
    reviewedAt: string | null;
  },
  content: ReportContent,
  source: ReportSource,
): ReportDocument {
  const inputs = source.snapshot.inputs;
  const display = source.result.display;
  const below = displayReportNumber;
  const legacy = meta.templateVersion === "pv-report-1.0.0";
  const itemNames = new Map(
    source.snapshot.modelVersion.content.stages.flatMap((stage) =>
      stage.categories.flatMap((category) =>
        category.items.map((item) => [item.id, item.dataName] as const),
      ),
    ),
  );
  const factors = source.snapshot.factors.filter((factor) =>
    source.result.lines.some((line) => line.factorVersionId === factor.id),
  );
  return {
    title: content.title || "碳足迹报告（未填写标题）",
    code: meta.code,
    revisionNo: meta.revisionNo,
    templateVersion: meta.templateVersion,
    status: meta.status,
    statusLabel: REPORT_STATUS_LABELS[meta.status],
    demonstration:
      source.demonstration || meta.templateSnapshot?.content.purpose === "TEST",
    contentHash: meta.contentHash ?? "草稿尚未冻结",
    reviewNote: meta.reviewedAt
      ? (meta.reviewerName ?? "审核人") +
        " / " +
        reportDateTime(meta.reviewedAt, legacy) +
        " / " +
        (meta.reviewReason ?? "")
      : "尚未完成报告审核",
    metadata: [
      ...(meta.templateSnapshot
        ? [
            [
              "报告模板版本",
              meta.templateSnapshot.code +
                " v" +
                meta.templateSnapshot.version +
                " · " +
                meta.templateSnapshot.title,
            ],
            ["模板确认依据", meta.templateSnapshot.content.approvalReference],
          ]
        : []),
      ["所属学校", source.school.name],
      ["报告编号 / 修订", meta.code + " / v" + meta.revisionNo],
      ["编制人 / 机构", content.preparedBy],
      ["报告日期", content.reportingDate],
      ["产品 / 项目", source.accountingCase.product],
      ["项目规格", inputs.specification],
      ["项目地点", inputs.projectLocation],
      ["数据采集期间", inputs.collectionStart + " 至 " + inputs.collectionEnd],
      ["功能单位", legacy ? "1 kWh 上网电量" : "1 kWh 输配电后交付电量"],
      [
        "核算案例 / 修订",
        source.accountingCase.code + " / v" + source.accountingCase.revisionNo,
      ],
      [
        "模型版本",
        source.snapshot.modelVersion.code +
          " v" +
          source.snapshot.modelVersion.version,
      ],
      [
        "规则版本",
        source.snapshot.ruleVersion.code +
          " v" +
          source.snapshot.ruleVersion.version,
      ],
      ["规则引用", source.snapshot.ruleVersion.content.standardReference],
      ["计算引擎", source.result.engineVersion],
      [
        "核算复核",
        source.accountingReview.actorName +
          " / " +
          reportDateTime(source.accountingReview.reviewedAt, legacy) +
          " / " +
          source.accountingReview.reason,
      ],
      ["计算运行 ID", source.run.id],
      ["运行输入摘要", source.run.inputHash],
    ],
    sections: [
      { title: "一、报告目的", text: content.purpose },
      {
        title: "二、系统边界与取舍",
        text:
          (legacy
            ? ""
            : "模型系统边界：" +
              source.snapshot.modelVersion.content.boundary +
              "\n核算边界说明：") +
          inputs.boundaryNote +
          "\n取舍项：" +
          inputs.exclusionNote,
      },
      { title: "三、核算方法与说明", text: content.methodology },
      { title: "四、数据质量与来源", text: content.dataQuality },
      { title: "五、结果分析与结论", text: content.conclusion },
      { title: "六、限制与声明", text: content.limitations },
    ],
    tables: [
      {
        title: "核算结果（固定运行快照）",
        columns: ["指标", "数值", "单位"],
        rows: [
          ...Object.entries(display.stagesKg).map(([stage, value]) => [
            REPORT_STAGE_NAMES[stage as keyof typeof REPORT_STAGE_NAMES],
            below(
              value,
              display.stagesBelowDisplayPrecision[
                stage as keyof typeof display.stagesKg
              ],
              "0.01",
            ),
            "kgCO₂e",
          ]),
          [
            "排放总量",
            below(
              display.totalEmissionsKg,
              display.totalBelowDisplayPrecision,
              "0.01",
            ),
            "kgCO₂e",
          ],
          [
            "上网电量",
            below(
              display.gridEnergyKwh,
              display.energyBelowDisplayPrecision,
              "0.01",
            ),
            "kWh",
          ],
          ...(!legacy
            ? [
                [
                  "输配电后电量（足迹分母）",
                  source.result.deliveredEnergyKwh,
                  "kWh",
                ],
              ]
            : []),
          [
            "单位电量碳足迹",
            below(
              display.footprintKgPerKwh,
              display.belowDisplayPrecision,
              "0.000001",
            ),
            "kgCO₂e/kWh",
          ],
        ],
      },
      {
        title: "逐项排放与换算",
        columns: [
          "阶段 / 数据项",
          "归一活动量",
          "排放量 (kgCO₂e)",
          "单位换算记录",
        ],
        rows: source.result.lines.map((line) => [
          REPORT_STAGE_NAMES[line.stage] +
            " / " +
            (itemNames.get(line.itemId) ?? line.itemId),
          line.normalizedActivity,
          line.emissionsKg,
          line.conversions
            .map(
              (entry) =>
                entry.originalValue +
                " " +
                entry.originalUnit +
                " → " +
                entry.convertedValue +
                " " +
                entry.targetUnit,
            )
            .join("；") || "无需换算",
        ]),
      },
      {
        title: "因子版本与来源",
        columns: ["因子 / 版本", "数值 / 单位", "来源与口径", "适用期间"],
        rows: factors.map((factor) => [
          factor.code + " v" + factor.version,
          factor.content.value + " kgCO₂e/" + factor.content.activityUnit,
          factor.content.evidence.issuer +
            "；" +
            factor.content.evidence.reference +
            "；" +
            factor.content.applicability.boundary,
          factor.content.applicability.validFrom +
            " 至 " +
            factor.content.applicability.validTo,
        ]),
      },
      {
        title: "活动数据与证据说明",
        columns: ["数据项", "原始记录", "期间 / 来源", "证据与说明"],
        rows: inputs.lines.map((line) => [
          itemNames.get(line.itemId) ?? line.itemId,
          line.state === "NOT_APPLICABLE"
            ? "不适用：" + (line.reason ?? "")
            : line.weight
              ? line.weight +
                " " +
                line.weightUnit +
                " × " +
                line.distance +
                " " +
                line.distanceUnit
              : (line.value ?? "由上网电量计算") + " " + (line.unit ?? ""),
          (line.activityDate ?? "") +
            " / " +
            (line.sourceType === "ESTIMATED" ? "估算" : "实测"),
          [line.evidence, line.measurementMethod, line.estimationMethod]
            .filter(Boolean)
            .join("；"),
        ]),
      },
      {
        title: "年度电量清单",
        columns: ["运行年", "起止期间", "电量", "来源与方法 / 证据"],
        rows: inputs.annualEnergy.map((row) => [
          String(row.operatingYear),
          row.periodStart + " 至 " + row.periodEnd,
          row.value + " " + row.unit,
          (row.source === "ESTIMATED" ? "估算" : "实测") +
            "；" +
            (row.method ?? "") +
            "；" +
            row.evidence,
        ]),
      },
      {
        title: "证据附件目录",
        columns: ["名称", "类型 / 大小", "内容 SHA-256"],
        rows: source.snapshot.assets.map((asset) => [
          asset.name,
          asset.mediaType + " / " + asset.size + " B",
          asset.contentHash,
        ]),
      },
      {
        title: "原始精度与追溯",
        columns: ["指标", "原始计算值"],
        rows: [
          ...Object.entries(source.result.stagesKg).map(([stage, value]) => [
            REPORT_STAGE_NAMES[stage as keyof typeof REPORT_STAGE_NAMES] +
              " (kgCO₂e)",
            value,
          ]),
          ["排放总量 (kgCO₂e)", source.result.totalEmissionsKg],
          ["上网电量 (kWh)", source.result.gridEnergyKwh],
          ["输送电量 (kWh)", source.result.deliveredEnergyKwh],
          ["单位电量碳足迹 (kgCO₂e/kWh)", source.result.footprintKgPerKwh],
          [
            "运行年数 / 线损率",
            inputs.operatingYears + " / " + inputs.lossRatio,
          ],
        ],
      },
    ],
  };
}
