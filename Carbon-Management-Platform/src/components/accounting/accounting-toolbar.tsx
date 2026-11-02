import Link from "next/link";
import { Button, Space, Typography } from "antd";
import type { CaseView } from "./types";
import type { useAccountingActions } from "./use-accounting-actions";
export function AccountingToolbar({
  entry,
  flow,
  canWrite,
  onReview,
}: {
  entry: CaseView;
  flow: ReturnType<typeof useAccountingActions>;
  canWrite: boolean;
  onReview: (decision: "APPROVE" | "REJECT") => void;
}) {
  const approved = entry.revisions.find(
    (revision) => revision.status === "APPROVED",
  );
  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white py-3">
      <Typography.Text type={flow.dirty ? "warning" : "secondary"}>
        {flow.dirty ? "输入尚未保存" : "当前修订 v" + flow.revision.revisionNo}
      </Typography.Text>
      <Space wrap>
        {canWrite && approved?.submittedRunId && (
          <Button>
            <Link href={"/reports?runId=" + approved.submittedRunId}>
              生成报告
            </Link>
          </Button>
        )}
        {flow.editable && (
          <>
            <Button onClick={() => void flow.save()} loading={flow.busy}>
              保存草稿
            </Button>
            <Button
              onClick={() => void flow.calculate("TRIAL")}
              disabled={flow.busy}
            >
              试算
            </Button>
            <Button
              type="primary"
              onClick={() => void flow.calculate("PRODUCTION")}
              disabled={flow.busy}
            >
              正式计算
            </Button>
            <Button
              onClick={() => void flow.transition("submit")}
              disabled={flow.busy || flow.dirty || !flow.productionRun}
            >
              提交审核
            </Button>
          </>
        )}
        {canWrite &&
          ["APPROVED", "REJECTED"].includes(flow.revision.status) && (
            <Button
              onClick={() => void flow.transition("revise")}
              loading={flow.busy}
            >
              创建新修订
            </Button>
          )}
        {flow.reviewable && (
          <>
            <Button
              type="primary"
              disabled={flow.busy}
              onClick={() => onReview("APPROVE")}
            >
              审核通过
            </Button>
            <Button
              danger
              disabled={flow.busy}
              onClick={() => onReview("REJECT")}
            >
              驳回
            </Button>
          </>
        )}
      </Space>
    </div>
  );
}
