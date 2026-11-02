"use client";
import { useState } from "react";
import { Alert, Spin } from "antd";

export function ReportPreview({
  revisionId,
  contentRevision,
  status,
  dirty,
}: {
  revisionId: string;
  contentRevision: number;
  status: string;
  dirty: boolean;
}) {
  const [loading, setLoading] = useState(true);
  return (
    <div className="space-y-3">
      {dirty && (
        <Alert
          type="warning"
          showIcon
          title="当前预览为已保存版本。请先保存草稿，再查看本次修改。"
        />
      )}
      <Spin spinning={loading} description="正在排版报告...">
        <iframe
          key={revisionId + ":" + contentRevision + ":" + status}
          title="报告排版预览"
          src={"/api/report-revisions/" + revisionId + "/preview"}
          sandbox="allow-same-origin"
          onLoad={async (event) => {
            const document = event.currentTarget.contentDocument;
            if (document?.fonts) await document.fonts.ready;
            setLoading(false);
          }}
          className={
            "h-[75vh] w-full rounded border border-slate-200 bg-white" +
            (loading ? " invisible" : "")
          }
        />
      </Spin>
    </div>
  );
}
