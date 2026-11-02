import type { PublicTemplateSnapshot } from "@/shared/report-template";
import type { ReportContent, ReportStatus } from "@/shared/reports";
import type { ReportSource } from "@/domain/reports/snapshot";

export type ApprovedRunOption = {
  id: string;
  caseId: string;
  caseCode: string;
  product: string;
  revisionNo: number;
};
export type ReportRow = {
  id: string;
  code: string;
  title: string;
  caseCode: string;
  revisionNo: number;
  status: ReportStatus;
  updatedAt: string;
};
export type ReportRevisionView = {
  id: string;
  reportId: string;
  revisionNo: number;
  contentRevision: number;
  status: ReportStatus;
  contentSnapshot: ReportContent;
  contentHash: string | null;
  createdById: string;
  lastEditedById: string;
  submittedById: string | null;
  submittedAt: string | null;
  reviewerName: string | null;
  reviewReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  export: { id: string; fileHash: string; createdAt: string } | null;
};
export type ReportView = {
  id: string;
  code: string;
  calculationRunId: string;
  templateVersion: string;
  templateSnapshot?: PublicTemplateSnapshot | null;
  sourceSnapshot: ReportSource;
  currentRevisionId: string;
  updatedAt: string;
  revisions: ReportRevisionView[];
};

export type ReportTemplateOption = { id: string; label: string };
