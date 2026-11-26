import type { AccountingInputs } from "@/shared/accounting";
import type { ModelContent } from "@/shared/models";
import type { PvCalculationResult } from "@/domain/calculation/pv";
import type { CalculationFactor } from "@/shared/emission-factors";
import type { FactorDetails } from "@/domain/calculation/factor-selection";
import type { PvRulePeriod } from "@/shared/calculation-rule";

export type ModelOption = { id: string; label: string };
export type FactorOption = FactorDetails & { id: string; label: string };
export type RuleOption = PvRulePeriod & { id: string; label: string };
export type AccountingFormValues = AccountingInputs & {
  ruleVersionId?: string | null;
};
export type EvidenceAsset = {
  id: string;
  name: string;
  mediaType: string;
  size: number;
  contentHash: string;
};
export type RunSnapshot = {
  modelVersion: {
    id: string;
    code: string;
    version: number;
    content: ModelContent;
  };
  inputs: AccountingInputs;
  factors: {
    id: string;
    code: string;
    version: string;
    content: CalculationFactor;
  }[];
  ruleVersion: {
    id: string;
    code: string;
    version: string;
    content: Record<string, unknown>;
  } | null;
  assets: EvidenceAsset[];
};
export type RunView = {
  id: string;
  mode: "TRIAL" | "PRODUCTION";
  inputRevision: number;
  inputHash: string;
  engineVersion: string;
  result: PvCalculationResult;
  snapshots: RunSnapshot;
  createdAt: string;
};
export type RevisionView = {
  id: string;
  revisionNo: number;
  inputRevision: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  modelVersionId: string;
  ruleVersionId: string | null;
  scenario: string;
  inputs: AccountingInputs;
  createdById: string;
  lastEditedById: string;
  submittedById: string | null;
  submittedRunId: string | null;
  modelVersion: {
    id: string;
    version: number;
    content: ModelContent;
    model: { code: string; scope: string; schoolId: string | null };
  };
  runs: RunView[];
  reviews: {
    id: string;
    decision: "APPROVE" | "REJECT";
    reason: string;
    actorId: string;
    createdAt: string;
  }[];
};
export type CaseView = {
  id: string;
  code: string;
  product: string;
  currentRevisionId: string;
  revisions: RevisionView[];
};
