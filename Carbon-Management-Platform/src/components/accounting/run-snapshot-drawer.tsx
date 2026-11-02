import Link from "next/link";
import { Descriptions, Drawer, Table, Typography } from "antd";
import { factorUnitLabel } from "@/shared/units";
import type { RunView } from "./types";
export function RunSnapshotDrawer({
  run,
  open,
  onClose,
}: {
  run: RunView;
  open: boolean;
  onClose: () => void;
}) {
  const snapshot = run.snapshots;
  const rule = snapshot.ruleVersion;
  return (
    <Drawer title="固定运行来源" open={open} onClose={onClose} size="large">
      <div className="space-y-5">
        <Descriptions
          column={1}
          size="small"
          bordered
          items={[
            {
              key: "model",
              label: "模型版本",
              children:
                snapshot.modelVersion.code +
                " v" +
                snapshot.modelVersion.version,
            },
            {
              key: "boundary",
              label: "模型系统边界",
              children: snapshot.modelVersion.content.boundary,
            },
            {
              key: "caseBoundary",
              label: "核算边界说明",
              children: snapshot.inputs.boundaryNote,
            },
            {
              key: "rule",
              label: "规则版本",
              children: rule ? rule.code + " v" + rule.version : "试算未配置",
            },
            {
              key: "reference",
              label: "标准引用",
              children: String(rule?.content.standardReference ?? "未配置"),
            },
            {
              key: "hash",
              label: "输入摘要",
              children: (
                <Typography.Text className="break-all" copyable>
                  {run.inputHash}
                </Typography.Text>
              ),
            },
          ]}
        />
        <Typography.Title level={5}>因子版本与来源</Typography.Title>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 650 }}
          dataSource={snapshot.factors.filter((factor) =>
            run.result.lines.some((line) => line.factorVersionId === factor.id),
          )}
          columns={[
            {
              title: "因子 / 版本",
              render: (_, factor) =>
                (factor.code.startsWith("MODEL-")
                  ? "模型内因子"
                  : factor.code) +
                " v" +
                factor.version,
            },
            {
              title: "数值 / 单位",
              render: (_, factor) =>
                factor.content.value +
                " " +
                factorUnitLabel(factor.content.activityUnit),
            },
            {
              title: "来源",
              render: (_, factor) =>
                factor.content.evidence.issuer +
                "；" +
                factor.content.evidence.reference,
            },
            {
              title: "期间",
              render: (_, factor) =>
                factor.content.applicability.validFrom +
                " 至 " +
                factor.content.applicability.validTo,
            },
          ]}
        />
        <Typography.Title level={5}>年度电量</Typography.Title>
        <Table
          rowKey="operatingYear"
          size="small"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 550 }}
          dataSource={snapshot.inputs.annualEnergy}
          columns={[
            { title: "运行年", dataIndex: "operatingYear" },
            {
              title: "期间",
              render: (_, row) => row.periodStart + " 至 " + row.periodEnd,
            },
            {
              title: "上网电量",
              render: (_, row) => row.value + " " + row.unit,
            },
            {
              title: "依据",
              render: (_, row) =>
                [row.method, row.evidence].filter(Boolean).join("；"),
            },
          ]}
        />
        <Typography.Title level={5}>证据附件</Typography.Title>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 450 }}
          dataSource={snapshot.assets}
          columns={[
            {
              title: "名称",
              render: (_, asset) => (
                <Link href={"/api/files/" + asset.id} target="_blank">
                  {asset.name}
                </Link>
              ),
            },
            { title: "大小", render: (_, asset) => asset.size + " B" },
            {
              title: "内容摘要",
              dataIndex: "contentHash",
              render: (hash: string) => (
                <Typography.Text className="break-all text-xs" copyable>
                  {hash}
                </Typography.Text>
              ),
            },
          ]}
        />
      </div>
    </Drawer>
  );
}
