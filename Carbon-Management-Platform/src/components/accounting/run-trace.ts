import { modelRows } from "./model-rows";
import { ACCOUNTING_STAGE_LABELS } from "@/shared/accounting";
import { factorUnitLabel, unitSymbol } from "@/shared/units";
import type { RunView } from "./types";
export function runTraceRows(run: RunView) {
  const snapshot = run.snapshots;
  const model = new Map(
    modelRows(snapshot.modelVersion.content).map((row) => [row.id, row]),
  );
  const inputs = new Map(
    snapshot.inputs.lines.map((line) => [line.itemId, line]),
  );
  const factors = new Map(
    snapshot.factors.map((factor) => [factor.id, factor]),
  );
  return run.result.lines.map((line) => {
    const item = model.get(line.itemId);
    const input = inputs.get(line.itemId);
    const factor = line.factorVersionId
      ? factors.get(line.factorVersionId)
      : undefined;
    const unit = item?.unit ?? factor?.content.activityUnit ?? "";
    const original =
      input?.state === "NOT_APPLICABLE"
        ? "不适用：" + input.reason
        : item?.role === "GRID_FACTOR"
          ? run.result.gridEnergyKwh + " kWh"
          : item?.role === "TRANSPORT"
            ? `${input?.weight ?? ""} ${unitSymbol(input?.weightUnit ?? "")} × ${input?.distance ?? ""} ${unitSymbol(input?.distanceUnit ?? "")}`
            : `${input?.value ?? ""} ${unitSymbol(input?.unit ?? "")}`;
    return {
      itemId: line.itemId,
      stage: ACCOUNTING_STAGE_LABELS[line.stage],
      name: item?.name ?? line.itemId,
      original,
      normalized: line.normalizedActivity + " " + unitSymbol(unit),
      factor: factor
        ? `${factor.code.startsWith("MODEL-") ? "模型内因子" : factor.code} v${factor.version} · ${factor.content.value} ${factorUnitLabel(factor.content.activityUnit)}`
        : "不适用",
      emissions: line.emissionsKg,
      conversions:
        line.conversions
          .map(
            (trace) =>
              `${trace.originalValue} ${unitSymbol(trace.originalUnit)} → ${trace.convertedValue} ${unitSymbol(trace.targetUnit)}`,
          )
          .join("；") || "无需换算",
    };
  });
}
