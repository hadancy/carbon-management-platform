"use client";
import { useState } from "react";
import { Alert, App, Button, Form, Input, Modal, Space, Upload } from "antd";
import {
  energyCsv,
  generateEnergyRows,
  parseEnergyCsv,
  type EnergyRow,
} from "./annual-energy-data";
type Generation = {
  first: string;
  value: string;
  evidence: string;
  method: string;
};
export function AnnualEnergyTools({
  rows,
  years,
  disabled,
  onChange,
  onAdd,
}: {
  rows: EnergyRow[];
  years: number;
  disabled: boolean;
  onChange: (rows: EnergyRow[]) => void;
  onAdd: () => void;
}) {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<Generation>();
  const [imported, setImported] = useState<ReturnType<
    typeof parseEnergyCsv
  > | null>(null);
  function download() {
    const url = URL.createObjectURL(
      new Blob(
        [
          energyCsv(
            rows.length
              ? rows
              : [
                  {
                    operatingYear: 1,
                    periodStart: "2025-01-01",
                    periodEnd: "2025-12-31",
                    source: "ESTIMATED",
                    value: "100000",
                    unit: "kWh",
                    evidence: "填写测算依据",
                    method: "填写估算方法",
                    evidenceAssetIds: [],
                  },
                ],
          ),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "运行年度电量.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  function generate(values: Generation) {
    try {
      const generated = generateEnergyRows(
        years,
        values.first,
        {
          source: "ESTIMATED",
          value: values.value,
          unit: "kWh",
          evidence: values.evidence,
          method: values.method,
          evidenceAssetIds: [],
        },
        rows,
      );
      onChange(generated);
      setOpen(false);
      message.success("已补齐缺失年度；现有年度已保留，请核对估算数据后保存");
    } catch (error) {
      message.error((error as Error).message);
    }
  }
  return (
    <>
      <Space wrap className="mb-3">
        <Button disabled={disabled || rows.length >= years} onClick={onAdd}>
          添加年度
        </Button>
        <Button
          disabled={disabled}
          onClick={() => {
            form.setFieldsValue({
              first:
                rows.find((row) => row.operatingYear === 1)?.periodStart ?? "",
              value: "",
              evidence: "",
              method: "",
            });
            setOpen(true);
          }}
        >
          批量生成年度
        </Button>
        <Button onClick={download}>下载 CSV 模板 / 当前数据</Button>
        <Upload
          accept=".csv"
          showUploadList={false}
          disabled={disabled}
          beforeUpload={(file) => {
            if (file.size > 500000) {
              message.error("CSV 不能超过 500 KB");
              return Upload.LIST_IGNORE;
            }
            file
              .text()
              .then((text) => {
                try {
                  setImported(parseEnergyCsv(text, years, rows));
                } catch (error) {
                  message.error((error as Error).message);
                }
              })
              .catch(() => message.error("读取文件失败"));
            return Upload.LIST_IGNORE;
          }}
        >
          <Button disabled={disabled}>导入 CSV</Button>
        </Upload>
      </Space>
      <Modal
        title={`补齐 ${years} 个运行年度`}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="生成估算年度"
        destroyOnHidden
      >
        <Alert
          className="mb-4"
          type="info"
          showIcon
          title="保留已有年度，仅补齐缺失年度。生成年度使用相同估算电量；请按实际衰减或测算结果修改，或导入逐年 CSV。"
        />
        <Form form={form} layout="vertical" onFinish={generate}>
          <Form.Item
            name="first"
            label="第 1 运行年起始日期"
            rules={[{ required: true, message: "请填写起始日期" }]}
          >
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="value"
            label="每个缺失年度电量（kWh）"
            rules={[{ required: true, message: "请填写电量" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="evidence"
            label="估算依据"
            rules={[{ required: true, whitespace: true }, { max: 200 }]}
          >
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item
            name="method"
            label="估算方法"
            rules={[{ required: true, whitespace: true }, { max: 200 }]}
          >
            <Input maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="核对 CSV 导入"
        open={!!imported}
        onCancel={() => setImported(null)}
        onOk={() => {
          if (imported) onChange(imported.rows);
          setImported(null);
          message.success("年度电量已导入草稿，请核对后保存");
        }}
        okText="应用导入"
        destroyOnHidden
      >
        <p>
          导入 {imported?.imported} 个年度，其中替换 {imported?.replaced}{" "}
          个已有年度。保留未导入年度和同一年度的已有附件。
        </p>
        <p>
          导入后共 {imported?.rows.length} 个年度 / 设计运行期 {years}{" "}
          年；保存前可继续编辑。
        </p>
      </Modal>
    </>
  );
}
