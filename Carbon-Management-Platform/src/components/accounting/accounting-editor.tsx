"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Alert, Card, Form, Select, Space, Tabs, Tag, Typography } from "antd";
import { ACCOUNTING_STATUS_LABELS } from "@/shared/accounting";
import type { AccountingInputs } from "@/shared/accounting";
import type { CaseView, FactorOption, RevisionView, RuleOption } from "./types";
import { ActivityLines } from "./activity-lines";
import { modelRows } from "./model-rows";
import { AnnualEnergyEditor } from "./annual-energy";
import { CaseMethodForm } from "./case-method-form";
import { RunResults } from "./run-results";
import { useAccountingActions } from "./use-accounting-actions";
import { AccountingToolbar } from "./accounting-toolbar";
import { AccountingReviewDialog } from "./accounting-review-dialog";
import { AccountingHistory } from "./accounting-history";
import { EvidenceLibrary } from "./evidence-library";
import { AccountingDiagnostics } from "./accounting-diagnostics";
function preparedInputs(revision: RevisionView): AccountingInputs {
  const saved = revision.inputs;
  const byId = new Map(saved.lines.map((line) => [line.itemId, line]));
  return {
    ...saved,
    lines: modelRows(revision.modelVersion.content).map(
      (row) =>
        byId.get(row.id) ?? {
          itemId: row.id,
          state: "RECORDED",
          unit: row.unit,
          evidenceAssetIds: [],
        },
    ),
  };
}
export function AccountingEditor({
  entry,
  factors,
  rules,
  canWrite,
  canReview,
  currentUserId,
}: {
  entry: CaseView;
  factors: FactorOption[];
  rules: RuleOption[];
  canWrite: boolean;
  canReview: boolean;
  currentUserId: string;
}) {
  const searchParams = useSearchParams();
  const chosen = searchParams.get("section");
  const section =
    chosen && ["method", "activities", "energy"].includes(chosen)
      ? chosen
      : "method";
  const flow = useAccountingActions(
    entry,
    canWrite,
    canReview,
    currentUserId,
    (name) =>
      selectSection(
        name === "lines"
          ? "activities"
          : name === "annualEnergy"
            ? "energy"
            : "method",
      ),
  );
  const [review, setReview] = useState<"APPROVE" | "REJECT" | null>(null);
  const revision = flow.revision;
  function selectSection(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", value);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }
  return (
    <EvidenceLibrary>
      <div className="min-w-0 space-y-4">
        <div>
          <Link href="/accounting">← 返回案例列表</Link>
          <Typography.Title level={3} className="!mb-1 break-words">
            {entry.code} · {entry.product}
          </Typography.Title>
          <Space wrap>
            <Tag>修订 v{revision.revisionNo}</Tag>
            <Tag
              color={
                revision.status === "APPROVED"
                  ? "green"
                  : revision.status === "REJECTED"
                    ? "red"
                    : revision.status === "SUBMITTED"
                      ? "blue"
                      : "default"
              }
            >
              {ACCOUNTING_STATUS_LABELS[revision.status]}
            </Tag>
            <Typography.Text type="secondary">
              模型 {revision.modelVersion.model.code} v
              {revision.modelVersion.version}
            </Typography.Text>
          </Space>
        </div>
        <AccountingToolbar
          entry={entry}
          flow={flow}
          canWrite={canWrite}
          onReview={setReview}
        />
        {flow.dirty && (
          <Alert
            type="warning"
            showIcon
            title="输入尚未保存；保存后需要重新计算"
          />
        )}
        {revision.status === "SUBMITTED" && !flow.reviewable && canReview && (
          <Alert
            type="info"
            showIcon
            title="创建人、最后编辑人或提交人不可审核此修订"
          />
        )}
        {flow.diagnostics.length > 0 && (
          <AccountingDiagnostics
            problems={flow.diagnostics}
            content={revision.modelVersion.content}
            form={flow.form}
            onSection={selectSection}
          />
        )}
        <Form
          form={flow.form}
          layout="vertical"
          initialValues={preparedInputs(revision)}
          onValuesChange={() => flow.setDirty(true)}
          disabled={!flow.editable}
          onFinishFailed={({ errorFields }) => {
            const first = errorFields[0]?.name?.[0];
            selectSection(
              first === "lines"
                ? "activities"
                : first === "annualEnergy"
                  ? "energy"
                  : "method",
            );
          }}
        >
          <Tabs
            activeKey={section}
            onChange={selectSection}
            items={[
              {
                key: "method",
                label: "基本信息与方法",
                forceRender: true,
                children: (
                  <CaseMethodForm
                    ruleVersionId={flow.ruleVersionId}
                    rules={rules}
                    disabled={!flow.editable}
                    onRuleChange={(id) => {
                      flow.setRuleVersionId(id);
                      flow.setDirty(true);
                    }}
                  />
                ),
              },
              {
                key: "activities",
                label: "生命周期活动数据",
                forceRender: true,
                children: (
                  <ActivityLines
                    content={revision.modelVersion.content}
                    factors={factors}
                    disabled={!flow.editable}
                  />
                ),
              },
              {
                key: "energy",
                label: "运行年度电量",
                forceRender: true,
                children: (
                  <AnnualEnergyEditor
                    disabled={!flow.editable}
                    onChange={() => flow.setDirty(true)}
                  />
                ),
              },
            ]}
          />
        </Form>
        <Card
          size="small"
          title="运行记录"
          extra={
            <Select
              aria-label="计算运行记录"
              className="w-72 max-w-[55vw]"
              value={flow.selectedRunId ?? undefined}
              placeholder="选择运行"
              options={entry.revisions.flatMap((item) =>
                item.runs.map((run) => ({
                  value: run.id,
                  label: `修订 v${item.revisionNo} · ${run.mode === "TRIAL" ? "试算" : "正式"} · ${new Date(run.createdAt).toLocaleString("zh-CN")}`,
                })),
              )}
              onChange={flow.setSelectedRunId}
            />
          }
        >
          <RunResults
            run={flow.viewedRun}
            currentInputRevision={revision.inputRevision}
            historical={flow.viewedRevision?.id !== revision.id}
          />
        </Card>
        <AccountingHistory revisions={entry.revisions} />
        <AccountingReviewDialog
          decision={review}
          busy={flow.busy}
          onCancel={() => setReview(null)}
          onReview={(decision, reason) =>
            flow.transition("review", decision, reason)
          }
        />
      </div>
    </EvidenceLibrary>
  );
}
