"use client";

import { App, Button, Empty, Image, Space, Typography, Upload } from "antd";

export function ModelBoundaryDiagramField({
  value,
  onChange,
  readOnly,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
}) {
  const { message } = App.useApp();

  return (
    <div className="space-y-1">
      <Typography.Text strong className="block">
        系统边界示意图
      </Typography.Text>
      <div className="mt-2">
        {value ? (
          <Image src={value} alt="系统边界示意图" width={240} />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无系统边界示意图"
            className="my-2"
          />
        )}
        {!readOnly && (
          <Space className="mt-2">
            <Upload
              showUploadList={false}
              accept="image/png,image/jpeg,image/webp"
              beforeUpload={(file) => {
                if (
                  !["image/png", "image/jpeg", "image/webp"].includes(
                    file.type,
                  ) ||
                  file.size > 2_000_000
                ) {
                  message.error("请上传不超过 2 MB 的 PNG、JPG 或 WebP 图片");
                  return false;
                }
                const reader = new FileReader();
                reader.onload = () => onChange(String(reader.result));
                reader.readAsDataURL(file);
                return false;
              }}
            >
              <Button>上传图片</Button>
            </Upload>
            {value && <Button onClick={() => onChange("")}>移除</Button>}
          </Space>
        )}
      </div>
    </div>
  );
}
