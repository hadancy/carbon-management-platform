import { ModuleLanding } from "@/components/module-landing";

export default function ModelsPage() {
  return (
    <ModuleLanding
      index="01"
      title="碳足迹模型"
      description="定义产品生命周期、活动数据项与因子，并管理模型版本。"
      steps={[
        "创建模型与草稿版本",
        "配置生命周期阶段和数据项",
        "提交审核并发布只读版本",
      ]}
    />
  );
}
