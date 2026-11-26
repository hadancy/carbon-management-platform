import type { ModelRow } from "@/domain/calculation/model-rows";
import {
  ACCOUNTING_STAGE_LABELS,
  MAX_EVIDENCE_ASSETS,
  type AccountingInputs,
} from "@/shared/accounting";

type EvidenceTarget = {
  key: string;
  label: string;
  section: "lines" | "annualEnergy";
  index: number;
  assetIds: string[];
};

export function batchEvidenceTargets(
  values: Partial<AccountingInputs>,
  rows: readonly ModelRow[],
): EvidenceTarget[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const activities = (values.lines ?? []).flatMap(
    (line, index): EvidenceTarget[] => {
      const row = byId.get(line.itemId);
      if (!row) return [];
      const stage =
        ACCOUNTING_STAGE_LABELS[
          row.stage as keyof typeof ACCOUNTING_STAGE_LABELS
        ];
      return [
        {
          key: `activity:${row.id}`,
          label: [stage, row.name].filter(Boolean).join(" / "),
          section: "lines",
          index,
          assetIds: line.evidenceAssetIds ?? [],
        },
      ];
    },
  );
  const annual = (values.annualEnergy ?? []).map(
    (row, index): EvidenceTarget => ({
      key: `year:${row.operatingYear}:${index}`,
      label: `第 ${row.operatingYear} 运行年${row.periodStart && row.periodEnd ? `（${row.periodStart} 至 ${row.periodEnd}）` : ""}`,
      section: "annualEnergy",
      index,
      assetIds: row.evidenceAssetIds ?? [],
    }),
  );
  return [...activities, ...annual];
}

export function planBatchEvidence(
  targets: EvidenceTarget[],
  selectedKeys: string[],
  assetIds: string[],
) {
  const keys = new Set(selectedKeys);
  const selected = targets.filter((target) => keys.has(target.key));
  if (selected.length !== keys.size)
    return {
      error: "部分记录已变化，请重新选择要关联的记录",
      updates: [],
    };
  const updates = selected.flatMap((target) => {
    const added = [...new Set(assetIds)].filter(
      (id) => !target.assetIds.includes(id),
    );
    return added.length
      ? [{ ...target, assetIds: [...target.assetIds, ...added] }]
      : [];
  });
  const overLimit = updates.filter(
    (target) => target.assetIds.length > MAX_EVIDENCE_ASSETS,
  );
  if (overLimit.length) {
    const names = overLimit
      .slice(0, 3)
      .map((target) => target.label)
      .join("、");
    return {
      error: `${names}${overLimit.length > 3 ? `等 ${overLimit.length} 条记录` : ""}将超过每条 ${MAX_EVIDENCE_ASSETS} 个附件的上限，请减少所选附件或记录`,
      updates: [],
    };
  }
  return { error: null, updates };
}
