import { Alert, Collapse, Descriptions, Typography } from "antd";
import { presentPublicDataContent } from "./content-presentation";
import type { Entry } from "./types";

export function PublicDataDetails({
  type,
  content,
  compact = false,
}: {
  type: Entry["type"];
  content: string;
  compact?: boolean;
}) {
  const view = presentPublicDataContent(type, content);
  return (
    <div
      className={`min-w-0 space-y-5 ${compact ? "" : "rounded border border-[#ebeef5] bg-white p-5"}`}
    >
      {view.notice && <Alert type="info" showIcon title={view.notice} />}
      {view.sections.map((section) => (
        <section key={section.key} aria-label={section.title}>
          <Typography.Title
            level={5}
            className="mt-0! mb-3! text-sm! font-semibold!"
          >
            {section.title}
          </Typography.Title>
          <Descriptions
            bordered
            size="small"
            layout={compact ? "vertical" : "horizontal"}
            column={compact ? { xs: 1, sm: 2 } : { xs: 1, md: 2, xxl: 3 }}
            classNames={{
              label: "whitespace-nowrap! text-[#909399]!",
              content:
                "min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
            }}
            items={section.fields.map((item) => ({
              key: item.key,
              label: item.label,
              span: item.fullWidth ? "filled" : 1,
              children: item.value ?? (
                <Typography.Text type="secondary">
                  {item.emptyText ?? "未填写"}
                </Typography.Text>
              ),
            }))}
          />
        </section>
      ))}
      <Collapse
        ghost
        size="small"
        classNames={{ header: "px-0! text-[#909399]!", body: "px-0! pb-0!" }}
        items={[
          {
            key: "original",
            label: "查看原始数据",
            children: (
              <pre className="m-0 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-[#f5f7fa] p-3 text-xs leading-5 text-[#606266] [overflow-wrap:anywhere]">
                {view.original}
              </pre>
            ),
          },
        ]}
      />
    </div>
  );
}
