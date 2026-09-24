import { ModuleLanding } from "@/components/module-landing";

export default function ReportsPage() {
  return (
    <ModuleLanding
      index="03"
      title="碳足迹报告"
      description="基于已审核核算快照编制、审核并导出报告。"
      steps={[
        "从已审核的核算结果生成草稿",
        "编辑说明并提交审核",
        "预览与下载 PDF 报告",
      ]}
    />
  );
}
