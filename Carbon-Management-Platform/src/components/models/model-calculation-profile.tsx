"use client";

import { Card, Select, Switch, Typography } from "antd";
import type { ModelContent } from "@/shared/models";
import { pvStages, synchronizePvProfile } from "@/shared/calculation-profile";

const stageLabels = {
  RS: "原材料及生产设备获取",
  TR: "运输",
  CS: "设施建设",
  US: "生产及退役",
  TD: "输配电",
};
const roleLabels = {
  ACTIVITY: "活动量 × 因子",
  TRANSPORT: "重量 × 距离 × 因子",
  GRID_FACTOR: "生命周期上网电量 × 因子",
};

export function ModelCalculationProfile({
  content,
  onChange,
  readOnly,
}: {
  content: ModelContent;
  onChange: (content: ModelContent) => void;
  readOnly: boolean;
}) {
  const profile = content.calculationProfile;
  function setStage(
    stageId: string,
    calculationStage: (typeof pvStages)[number],
  ) {
    if (!profile) return;
    const stageMappings = profile.stageMappings.filter(
      (entry) => entry.stageId !== stageId,
    );
    stageMappings.push({ stageId, calculationStage });
    onChange(
      synchronizePvProfile({
        ...content,
        calculationProfile: { ...profile, stageMappings },
      }),
    );
  }
  return (
    <Card size="small" title="光伏计算映射">
      <div className="flex items-center gap-3">
        <Switch
          checked={!!profile}
          disabled={readOnly}
          onChange={(enabled) =>
            onChange({
              ...content,
              calculationProfile: enabled
                ? {
                    product: "PV",
                    formula: "PV_GRID_V1",
                    stageMappings: [],
                    itemMappings: [],
                  }
                : undefined,
            })
          }
        />
        <Typography.Text>将模型用于并网光伏核算</Typography.Text>
      </div>
      {profile && (
        <>
          <Typography.Paragraph type="secondary" className="mt-3 mb-3 text-xs">
            为每个模型阶段指定稳定的计算阶段；数据项自动继承角色和因子分母。五个计算阶段都须覆盖，输配电阶段只保留一条因子项。模型发布后映射随版本冻结。
          </Typography.Paragraph>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {content.stages.map((stage) => (
              <div key={stage.id} className="flex flex-col gap-1">
                <Typography.Text>{stage.name || "未命名阶段"}</Typography.Text>
                <Select
                  aria-label={`${stage.name || "未命名阶段"}计算阶段`}
                  disabled={readOnly}
                  value={
                    profile.stageMappings.find(
                      (entry) => entry.stageId === stage.id,
                    )?.calculationStage
                  }
                  placeholder="选择计算阶段"
                  options={pvStages.map((value) => ({
                    value,
                    label: stageLabels[value],
                  }))}
                  onChange={(value) => setStage(stage.id, value)}
                />
                <ul className="m-0 list-none space-y-1 p-0 text-xs text-slate-500">
                  {stage.categories
                    .flatMap((category) => category.items)
                    .map((item) => {
                      const itemMapping = profile.itemMappings.find(
                        (entry) => entry.itemId === item.id,
                      );
                      return (
                        <li key={item.id}>
                          {item.dataName || "未命名数据项"}：
                          {itemMapping
                            ? `${roleLabels[itemMapping.role]}；因子分母 ${itemMapping.factorActivityUnit}`
                            : "待选计算阶段"}
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
