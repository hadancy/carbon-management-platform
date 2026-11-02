import { createHash } from "node:crypto";
import { calculatePv } from "@/domain/calculation/pv";
import { pvAcceptanceSchema, type PvAcceptanceBundle } from "./pv-contract";
import { comparePvResult, type AcceptanceComparison } from "./pv-comparison";
import { checkPvBusinessReadiness } from "./pv-readiness";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function acceptanceHash(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function acceptanceScopeHash(bundle: PvAcceptanceBundle): string {
  return acceptanceHash({
    caseId: bundle.caseId,
    caseKind: bundle.caseKind,
    schoolId: bundle.schoolId,
    snapshot: bundle.snapshot,
    expected: bundle.expected,
    // Signed decision documents can themselves mention this scope hash. Only
    // the independent numeric source belongs in the hashed scope; attachment
    // hashes are already frozen in snapshot.assets. This avoids a circular hash.
    expectedEvidence: bundle.evidence
      .filter((entry) => entry.id === bundle.expected.evidenceId)
      .map(({ id, sha256 }) => ({ id, sha256 })),
    engineVersion: "pv-grid-1.0.0",
    run: bundle.run,
  });
}

// Expected values come from independent calculations, never calculatePv.
export function verifyPvAcceptance(
  raw: unknown,
  verifiedEvidenceIds: ReadonlySet<string> = new Set(),
) {
  const parsed = pvAcceptanceSchema.safeParse(raw);
  if (!parsed.success)
    return {
      status: "INVALID" as const,
      numericalPassed: false,
      scopeHash: null,
      comparisons: [] as AcceptanceComparison[],
      blockers: parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
      result: null,
    };
  const bundle = parsed.data;
  const { snapshot, expected } = bundle;
  const scopeHash = acceptanceScopeHash(bundle);
  const blockers: string[] = [];
  const outcome = calculatePv({
    ...snapshot.inputs,
    scenario: snapshot.scenario,
    mode: snapshot.mode,
    model: {
      id: snapshot.modelVersion.id,
      scope: "SCHOOL",
      status: "PUBLISHED",
      content: snapshot.modelVersion.content,
    },
    factors: snapshot.factors,
  });
  if (!outcome.ok)
    return {
      status: "INVALID" as const,
      numericalPassed: false,
      scopeHash,
      comparisons: [] as AcceptanceComparison[],
      blockers: outcome.diagnostics.map(
        (item) => `${item.path}: ${item.message}`,
      ),
      result: null,
    };
  const result = outcome.result;
  const { comparisons, problems } = comparePvResult(expected, result);
  blockers.push(...problems);
  if (bundle.run) {
    if (
      bundle.run.schoolId !== bundle.schoolId ||
      acceptanceHash(bundle.run.snapshots) !== acceptanceHash(snapshot)
    )
      blockers.push("已保存运行的学校或输入快照与验收范围不一致");
    if (
      bundle.run.engineVersion !== result.engineVersion ||
      acceptanceHash(bundle.run.result) !== acceptanceHash(result)
    )
      blockers.push("已保存结果或引擎版本与本次复算不一致");
  }
  const numericalPassed =
    comparisons.every((item) => item.passed) && !blockers.length;
  if (comparisons.some((item) => !item.passed))
    blockers.push("系统结果与独立预期不一致");
  blockers.push(
    ...checkPvBusinessReadiness(bundle, scopeHash, verifiedEvidenceIds),
  );
  return {
    status: !numericalPassed
      ? ("FAILED" as const)
      : blockers.length
        ? ("PENDING_BUSINESS" as const)
        : ("READY_FOR_REVIEW" as const),
    numericalPassed,
    scopeHash,
    comparisons,
    blockers,
    result,
  };
}
