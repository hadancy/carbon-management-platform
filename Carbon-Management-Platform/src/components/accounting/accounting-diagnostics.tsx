import { Alert, Button } from "antd";
import type { FormInstance } from "antd";
import type { CalculationDiagnostic } from "@/domain/calculation/pv";
import {
  ACCOUNTING_STAGE_LABELS,
  type AccountingInputs,
} from "@/shared/accounting";
import type { ModelContent } from "@/shared/models";
import { modelRows } from "./model-rows";
const labels: Record<string, string> = {
  value: "活动量",
  unit: "活动单位",
  weight: "运输重量",
  weightUnit: "重量单位",
  distance: "运输距离",
  distanceUnit: "距离单位",
  factorVersionId: "公用因子版本",
  evidence: "凭证说明",
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
export function AccountingDiagnostics({
  problems,
  content,
  form,
  onSection,
}: {
  problems: CalculationDiagnostic[];
  content: ModelContent;
  form: FormInstance<AccountingInputs>;
  onSection: (section: string) => void;
}) {
  const rows = modelRows(content);
  function location(path: string) {
    const parts = path.split(".");
    const index = Number(parts[1]);
    const field = labels[parts.at(-1)!] ?? "数据完整性";
    if (parts[0] === "lines") {
      const row = rows[index] ?? rows.find((row) => row.id === parts[1]);
      return `${row ? ACCOUNTING_STAGE_LABELS[row.stage as keyof typeof ACCOUNTING_STAGE_LABELS] + " / " + row.name : "生命周期活动数据"} / ${field}`;
    }
    if (parts[0] === "annualEnergy") {
      const annual = form.getFieldValue("annualEnergy")?.[index];
      return `运行年度 ${annual?.operatingYear ?? (Number.isFinite(index) ? index : "电量")} / ${field}`;
    }
    return labels[parts[0]] ?? "核算方法与基本信息";
  }
  return (
    <Alert
      type="error"
      showIcon
      title="请修正以下数据"
      description={
        <ul className="m-0 space-y-1 pl-4">
          {problems.map((problem, index) => (
            <li key={index}>
              <Button
                type="link"
                className="!h-auto !whitespace-normal !p-0 !text-left"
                onClick={() => {
                  const parts = problem.path
                    .split(".")
                    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
                  onSection(
                    parts[0] === "lines"
                      ? "activities"
                      : parts[0] === "annualEnergy"
                        ? "energy"
                        : "method",
                  );
                  requestAnimationFrame(() =>
                    form.scrollToField(
                      parts[0] === "annualEnergy" ? ["annualEnergy"] : parts,
                      { focus: true, block: "center" },
                    ),
                  );
                }}
              >
                {location(problem.path)}
              </Button>
              ：{problem.message}。{problem.suggestion}
            </li>
          ))}
        </ul>
      }
    />
  );
}
