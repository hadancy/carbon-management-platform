import { Alert, Collapse, Typography } from "antd";
import { presentPublicDataContent } from "./content-presentation";
import { PublicDataDetails } from "./public-data-details";

export function LegacyFactorPreview({ content }: { content: string }) {
  const view = presentPublicDataContent("EMISSION_FACTOR", content);
  return (
    <Alert
      type="warning"
      showIcon
      title="旧版本内容核对"
      className="mb-5"
      description={
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <Typography.Text strong>
              {view.headline ?? "因子数值待核对"}
            </Typography.Text>
            <Typography.Text type="secondary">
              用途：{view.purpose ?? "未填写"}
            </Typography.Text>
          </div>
          {view.note && (
            <Typography.Paragraph
              ellipsis={{ rows: 2, expandable: true, symbol: "展开说明" }}
              className="mb-1! whitespace-pre-wrap text-xs!"
            >
              {view.note}
            </Typography.Paragraph>
          )}
          <Typography.Paragraph type="secondary" className="mb-0! text-xs!">
            请核对适用范围、来源和变更依据；保存新版本时会保留旧版原文。
          </Typography.Paragraph>
          <Collapse
            key={content}
            ghost
            size="small"
            classNames={{ header: "px-0! pb-0!", body: "px-0! pb-0!" }}
            items={[
              {
                key: "details",
                label: "展开旧版本详情",
                children: (
                  <PublicDataDetails
                    type="EMISSION_FACTOR"
                    content={content}
                    compact
                  />
                ),
              },
            ]}
          />
        </div>
      }
    />
  );
}
