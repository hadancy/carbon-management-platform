import { ModuleLanding } from "@/components/module-landing";

export default function AccountingPage() {
  return (
    <ModuleLanding
      index="02"
      title="碳足迹核算"
      description="选择已发布模型，录入活动数据，生成可追溯的核算结果。"
      steps={[
        "创建核算案例并选择模型版本",
        "录入活动数据和证据",
        "服务端计算、复核和审核",
      ]}
    />
  );
}
