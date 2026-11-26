import { Alert, Button } from "antd";
import type { CalculationDiagnostic } from "@/domain/calculation/pv";
import type { ModelRow } from "@/domain/calculation/model-rows";
import {
  ACCOUNTING_STAGE_LABELS,
  type AccountingInputs,
} from "@/shared/accounting";
const labels: Record<string, string> = {
  specification: "产品规格",
  measurementUnit: "计量单位",
  projectLocation: "项目地点",
  collectionStart: "采集开始日期",
  collectionEnd: "采集结束日期",
  boundaryNote: "案例系统边界",
  exclusionNote: "取舍与排除说明",
  ruleVersionId: "规则版本",
  region: "地域",
  technology: "技术/设备类型",
  value: "活动量",
  unit: "活动单位",
  weight: "运输重量",
  weightUnit: "重量单位",
  distance: "运输距离",
  distanceUnit: "距离单位",
  factorVersionId: "公用因子版本",
  evidence: "凭证说明",
  evidenceAssetIds: "证据附件",
  location: "发生地点",
  process: "设备或工艺",
  measurementMethod: "计量方法",
  sourceType: "数据类型",
  estimationMethod: "估算方法",
  reason: "零值或不适用原因",
  activityDate: "活动日期",
  state: "数据状态",
  periodStart: "期间起始",
  periodEnd: "期间结束",
  operatingYear: "运行年序号",
  source: "数据类型",
  method: "估算方法",
  lossRatio: "线损比例",
  referenceDate: "核算参考日期",
  operatingYears: "运行年数",
  directSupplyKwh: "直供电量",
  transmissionMethod: "输配电方法",
  transmissionFallbackReason: "简化法使用理由",
};

export function accountingSection(path: string) {
  const root = path.split(".")[0];
  return root === "lines"
    ? "activities"
    : root === "annualEnergy"
      ? "energy"
      : "method";
}

export function accountingIssueTarget(
  problem: CalculationDiagnostic,
  rows: readonly ModelRow[],
  annual: AccountingInputs["annualEnergy"],
) {
  const [root, rowKey, field] = problem.path.split(".");
  const index = Number(rowKey);
  if (root === "lines") {
    const rowIndex = Number.isInteger(index)
      ? index
      : rows.findIndex((row) => row.id === rowKey);
    const row = rows[rowIndex];
    const stage = row
      ? ACCOUNTING_STAGE_LABELS[
          row.stage as keyof typeof ACCOUNTING_STAGE_LABELS
        ]
      : undefined;
    return {
      label: [
        stage,
        row?.name ?? "生命周期活动数据",
        labels[field] ?? "数据完整性",
      ]
        .filter(Boolean)
        .join(" / "),
      name: row
        ? [
            root,
            rowIndex,
            field ??
              (problem.code === "INVALID_TRANSPORT" ? "weight" : "state"),
          ]
        : undefined,
    };
  }
  if (root === "annualEnergy") {
    const byYear =
      problem.code === "MISSING_YEAR" || problem.code === "PERIOD_GAP";
    const row = byYear ? undefined : annual[index];
    const year = row?.operatingYear ?? (byYear ? index : undefined);
    return {
      label:
        year === undefined
          ? "运行年度电量"
          : `运行年度 ${year} / ${labels[field] ?? "电量和期间"}`,
      name: [root],
      annualEdit: row
        ? {
            index,
            field:
              field ??
              (problem.code === "MISSING_EVIDENCE"
                ? "evidence"
                : "operatingYear"),
          }
        : undefined,
    };
  }
  return {
    label: labels[root] ?? "核算方法与基本信息",
    name: labels[root] ? [root] : undefined,
  };
}

type IssueListProps = {
  problems: CalculationDiagnostic[];
  rows: readonly ModelRow[];
  annual: AccountingInputs["annualEnergy"];
  onIssue: (problem: CalculationDiagnostic) => void;
};

export function AccountingIssueList({
  problems,
  rows,
  annual,
  onIssue,
}: IssueListProps) {
  return (
    <ul className="m-0 space-y-1 pl-4">
      {problems.map((problem, index) => (
        <li key={index} className="break-words">
          <Button
            type="link"
            className="!h-auto !whitespace-normal !p-0 !text-left"
            onClick={() => onIssue(problem)}
          >
            {accountingIssueTarget(problem, rows, annual).label}
          </Button>
          {" · "}
          {problem.message}
        </li>
      ))}
    </ul>
  );
}

export function AccountingDiagnostics(props: IssueListProps) {
  return (
    <Alert
      type="error"
      showIcon
      title="请修正以下数据"
      description={<AccountingIssueList {...props} />}
    />
  );
}
