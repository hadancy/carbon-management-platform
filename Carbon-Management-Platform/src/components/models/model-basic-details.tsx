import { Descriptions, Typography } from "antd";
import type { ModelContent } from "@/shared/models";
import { isKnownUnit, unitSymbol } from "@/shared/units";

export function ModelBasicDetails({ content }: { content: ModelContent }) {
  return (
    <Descriptions
      bordered
      size="small"
      column={{ xs: 1, sm: 1, md: 2 }}
      items={[
        { key: "name", label: "模型名称", children: content.name },
        {
          key: "functionalUnit",
          label: "功能单位",
          children: isKnownUnit(content.functionalUnit)
            ? `${content.functionalQuantity ?? "未填写"} ${unitSymbol(content.functionalUnit)}${content.functionalDescription ? ` · ${content.functionalDescription}` : ""}`
            : content.functionalUnit,
        },
        { key: "boundary", label: "系统边界", children: content.boundary },
        {
          key: "referenceStandard",
          label: "引用标准",
          children: content.referenceStandard,
        },
        {
          key: "description",
          label: "说明",
          span: "filled",
          children: content.description || (
            <Typography.Text type="secondary">暂无说明</Typography.Text>
          ),
        },
      ]}
    />
  );
}
