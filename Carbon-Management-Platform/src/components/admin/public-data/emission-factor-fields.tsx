import { Form, Input, Select, Typography } from "antd";
import { factorUnitLabel, isNumericFactor, unitOptions } from "@/shared/units";
import type { PublicDataForm } from "./types";

export function EmissionFactorFields({
  activityUnit,
  publishMode,
}: {
  activityUnit?: string;
  publishMode: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Form.Item
          label="因子数值"
          name="factorValue"
          rules={[
            { required: publishMode, message: "请填写因子数值" },
            {
              validator: (_, value: string) =>
                !value || isNumericFactor(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error("因子数值只能填写数字")),
            },
          ]}
        >
          <Input maxLength={80} placeholder="仅输入数值" />
        </Form.Item>
        <Form.Item
          label="对应的活动数据单位"
          name="factorActivityUnit"
          extra="暂无所需单位？请联系平台管理员申请新增；未确认单位不能发布。"
          rules={[{ required: publishMode, message: "请选择活动数据单位" }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            allowClear
            options={unitOptions}
            placeholder="选择活动数据单位"
          />
        </Form.Item>
      </div>
      <Typography.Paragraph type="secondary" className="-mt-2 text-xs">
        完整因子单位：
        {activityUnit
          ? factorUnitLabel(activityUnit)
          : "选择活动数据单位后自动生成"}
      </Typography.Paragraph>
      <Form.Item<PublicDataForm> label="因子说明" name="factorNote">
        <Input.TextArea rows={3} maxLength={2000} />
      </Form.Item>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Form.Item
          label="用途"
          name="factorPurpose"
          rules={[{ required: publishMode }]}
        >
          <Select
            options={[
              { value: "TEST", label: "测试" },
              { value: "PRODUCTION", label: "正式" },
            ]}
          />
        </Form.Item>
        <Form.Item
          label="适用计算阶段"
          name="factorStage"
          rules={[{ required: publishMode }]}
        >
          <Select
            options={[
              { value: "RS", label: "原材料与生产设备" },
              { value: "TR", label: "运输" },
              { value: "CS", label: "设施建设" },
              { value: "US", label: "生产及退役" },
              { value: "TD", label: "输配电" },
            ]}
          />
        </Form.Item>
        <Form.Item
          label="适用对象"
          name="factorSubject"
          rules={[{ required: publishMode }]}
        >
          <Input placeholder="与模型数据项名称一致，或 ALL" />
        </Form.Item>
        <Form.Item
          label="适用地域"
          name="factorRegion"
          rules={[{ required: publishMode }]}
        >
          <Input placeholder="地区名称，或 ALL" />
        </Form.Item>
        <Form.Item
          label="适用技术"
          name="factorTechnology"
          rules={[{ required: publishMode }]}
        >
          <Input placeholder="工艺/设备技术，或 ALL" />
        </Form.Item>
        <Form.Item
          label="数据所属年度"
          name="factorDataYear"
          rules={[{ required: publishMode }]}
        >
          <Input type="number" min={1900} max={2200} />
        </Form.Item>
        <Form.Item
          label="适用开始日期"
          name="factorValidFrom"
          rules={[{ required: publishMode }]}
        >
          <Input type="date" />
        </Form.Item>
        <Form.Item
          label="适用结束日期"
          name="factorValidTo"
          rules={[{ required: publishMode }]}
        >
          <Input type="date" />
        </Form.Item>
      </div>
      <Form.Item
        label="覆盖的排放边界"
        name="factorBoundary"
        rules={[{ required: publishMode }]}
      >
        <Input.TextArea rows={2} maxLength={500} />
      </Form.Item>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Form.Item
          label="来源类别"
          name="factorSourceCategory"
          rules={[{ required: publishMode }]}
        >
          <Select
            options={[
              { value: "SUPPLIER", label: "供应商" },
              { value: "GOVERNMENT", label: "政府" },
              { value: "INDUSTRY", label: "行业" },
              { value: "DATABASE", label: "数据库" },
              { value: "LITERATURE", label: "文献" },
              { value: "STANDARD_APPENDIX", label: "标准资料附录" },
              { value: "OTHER", label: "其他" },
            ]}
          />
        </Form.Item>
        <Form.Item
          label="发布机构"
          name="factorIssuer"
          rules={[{ required: publishMode }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="资料发布日期"
          name="factorPublishedAt"
          rules={[{ required: publishMode }]}
        >
          <Input type="date" />
        </Form.Item>
        <Form.Item
          label="原始数值及单位"
          name="factorOriginalValue"
          rules={[{ required: publishMode }]}
        >
          <Input />
        </Form.Item>
      </div>
      <Form.Item
        label="资料定位（表号、页码或链接）"
        name="factorReference"
        rules={[{ required: publishMode }]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="原值到当前因子的换算过程"
        name="factorConversion"
        rules={[{ required: publishMode }]}
      >
        <Input.TextArea rows={2} />
      </Form.Item>
      <Form.Item
        label="授权或使用依据"
        name="factorLicense"
        rules={[{ required: publishMode }]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="业务依据"
        name="factorBasis"
        rules={[{ required: publishMode }]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="版本变更原因"
        name="factorChangeReason"
        rules={[{ required: publishMode }]}
      >
        <Input />
      </Form.Item>
      <Form.Item name="factorSupersedesVersionId" hidden>
        <Input />
      </Form.Item>
    </>
  );
}
