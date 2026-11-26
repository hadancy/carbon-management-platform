"use client";
import { formatBeijingTime } from "@/shared/beijing-time";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { ReportContent } from "@/shared/reports";
import { REPORT_STATUS_LABELS } from "@/shared/reports";
import { useUnsavedChangesWarning } from "@/components/backend/use-unsaved-changes-warning";
import type { ReportRevisionView, ReportView } from "./types";
import { ReportContentForm } from "./report-content-form";
import { ReportReviewDialog } from "./report-review-dialog";
import { ReportPreview } from "./report-preview";
import { ReportSourceSummary } from "./report-source-summary";
import { useReportActions } from "./use-report-actions";

const subscribeToClientReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function ReportWorkbench({
  initialEntry,
  canWrite,
  canReview,
  canExport,
  currentUserId,
}: {
  initialEntry: ReportView;
  canWrite: boolean;
  canReview: boolean;
  canExport: boolean;
  currentUserId: string;
}) {
  const [entry, setEntry] = useState(initialEntry);
  const ready = useSyncExternalStore(
    subscribeToClientReady,
    clientReady,
    serverReady,
  );
  const [selectedId, setSelectedId] = useState(entry.currentRevisionId);
  const [activeTab, setActiveTab] = useState("content");
  const [dirty, setDirty] = useState(false);
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  const [form] = Form.useForm<ReportContent>();
  const { modal } = App.useApp();
  const revision = entry.revisions.find((item) => item.id === selectedId)!;
  const current = revision.id === entry.currentRevisionId;
  const editable = canWrite && current && revision.status === "DRAFT";
  const selfReview = [
    revision.createdById,
    revision.lastEditedById,
    revision.submittedById,
  ].includes(currentUserId);
  const reviewable =
    canReview && current && revision.status === "SUBMITTED" && !selfReview;
  useUnsavedChangesWarning(editable && dirty);
  function onSaved(next: ReportRevisionView) {
    setEntry((previous) => ({
      ...previous,
      revisions: previous.revisions.map((item) =>
        item.id === next.id ? next : item,
      ),
    }));
  }
  const actions = useReportActions({
    reportId: entry.id,
    reportCode: entry.code,
    revision,
    form,
    dirty,
    onSaved,
    onClean: () => setDirty(false),
  });
  function selectRevision(id: string) {
    const select = () => {
      setSelectedId(id);
      setDirty(false);
      form.resetFields();
      form.setFieldsValue(
        entry.revisions.find((item) => item.id === id)!.contentSnapshot,
      );
    };
    if (dirty)
      modal.confirm({
        title: "当前报告有未保存修改",
        content: "切换修订将放弃这些修改。",
        okText: "放弃修改并切换",
        cancelText: "继续编辑",
        onOk: select,
      });
    else select();
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!mb-1">
            {entry.code}
          </Typography.Title>
          <Typography.Text type="secondary">
            报告修订保留历史正文，所有修订绑定同一核算运行。
          </Typography.Text>
        </div>
        <Space wrap>
          <Button>
            <Link href="/reports">返回报告列表</Link>
          </Button>
          <Select
            aria-label="报告修订"
            value={selectedId}
            onChange={selectRevision}
            disabled={actions.busy || !ready}
            className="min-w-56"
            options={entry.revisions.map((item) => ({
              value: item.id,
              label:
                "v" +
                item.revisionNo +
                " · " +
                REPORT_STATUS_LABELS[item.status] +
                (item.id === entry.currentRevisionId ? " · 当前" : " · 历史"),
            }))}
          />
        </Space>
      </div>
      <ReportSourceSummary
        source={entry.sourceSnapshot}
        templateVersion={entry.templateVersion}
        templateSnapshot={entry.templateSnapshot}
      />
      <Card
        size="small"
        title={
          <Space>
            <span>报告修订 v{revision.revisionNo}</span>
            <Tag
              color={
                revision.status === "APPROVED"
                  ? "green"
                  : revision.status === "REJECTED"
                    ? "red"
                    : "blue"
              }
            >
              {REPORT_STATUS_LABELS[revision.status]}
            </Tag>
            {dirty && <Tag color="orange">未保存</Tag>}
          </Space>
        }
        extra={
          <Space wrap>
            {editable && (
              <>
                <Button
                  disabled={actions.busy || !ready}
                  onClick={actions.save}
                >
                  保存草稿
                </Button>
                <Button
                  type="primary"
                  loading={actions.busy}
                  disabled={!ready}
                  onClick={actions.submit}
                >
                  提交审核
                </Button>
              </>
            )}
            {canWrite &&
              current &&
              ["REJECTED", "APPROVED"].includes(revision.status) && (
                <Button
                  type="primary"
                  disabled={actions.busy || !ready}
                  onClick={actions.revise}
                >
                  创建新修订
                </Button>
              )}
            {reviewable && (
              <>
                <Button
                  danger
                  disabled={actions.busy || !ready}
                  onClick={() => setDecision("REJECT")}
                >
                  驳回
                </Button>
                <Button
                  type="primary"
                  disabled={actions.busy || !ready}
                  onClick={() => setDecision("APPROVE")}
                >
                  审核通过
                </Button>
              </>
            )}
            {canExport && revision.status === "APPROVED" && (
              <Button
                disabled={!ready}
                loading={actions.busy}
                onClick={actions.exportPdf}
              >
                导出 PDF
              </Button>
            )}
          </Space>
        }
      >
        {canReview && revision.status === "SUBMITTED" && selfReview && (
          <Alert
            type="warning"
            showIcon
            title="创建人、最后编辑人和提交人不能审核此报告，请由其他审核人复核。"
            className="!mb-3"
          />
        )}
        {revision.reviewedAt && (
          <Alert
            type={revision.status === "REJECTED" ? "error" : "success"}
            showIcon
            title={
              REPORT_STATUS_LABELS[revision.status] +
              " · " +
              revision.reviewerName
            }
            description={revision.reviewReason}
            className="!mb-3"
          />
        )}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          destroyOnHidden={false}
          items={[
            {
              key: "content",
              label: editable ? "报告编辑" : "报告正文",
              children: (
                <ReportContentForm
                  key={selectedId}
                  form={form}
                  content={revision.contentSnapshot}
                  editable={editable}
                  busy={actions.busy || !ready}
                  onChange={() => setDirty(true)}
                />
              ),
            },
            {
              key: "preview",
              label: "报告预览",
              children: (
                <ReportPreview
                  key={
                    revision.id +
                    ":" +
                    revision.contentRevision +
                    ":" +
                    revision.status
                  }
                  revisionId={revision.id}
                  contentRevision={revision.contentRevision}
                  status={revision.status}
                  dirty={dirty}
                />
              ),
            },
            {
              key: "history",
              label: "冻结与审核记录",
              children: (
                <div className="space-y-3 text-sm">
                  <p>
                    正文版本：{revision.contentRevision}；提交时间：
                    {revision.submittedAt
                      ? formatBeijingTime(revision.submittedAt)
                      : "未提交"}
                  </p>
                  <p>
                    审核时间：
                    {revision.reviewedAt
                      ? formatBeijingTime(revision.reviewedAt)
                      : "未审核"}
                  </p>
                  <p className="break-all">
                    正文与来源摘要：{revision.contentHash ?? "草稿尚未冻结"}
                  </p>
                  {revision.export && (
                    <p className="break-all">
                      PDF 文件摘要：{revision.export.fileHash}
                    </p>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
      <ReportReviewDialog
        decision={decision}
        busy={actions.busy}
        onCancel={() => setDecision(null)}
        onReview={actions.review}
      />
    </div>
  );
}
