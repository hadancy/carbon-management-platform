"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { App, Button, Select, Space, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { useEvidenceLibrary } from "./evidence-library";
import type { EvidenceAsset } from "./types";

export function EvidenceUpload({
  value = [],
  onChange,
  disabled = false,
}: {
  value?: string[];
  onChange?: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const library = useEvidenceLibrary();
  const [names, setNames] = useState<EvidenceAsset[]>([]);
  const idsKey = value.join(",");
  useEffect(() => {
    if (!idsKey) return;
    const controller = new AbortController();
    fetch(`/api/files?ids=${encodeURIComponent(idsKey)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.ok) setNames((await response.json()).assets);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [idsKey]);
  async function upload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/files", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as {
        asset?: EvidenceAsset;
        error?: string;
      };
      if (!response.ok || !data.asset)
        throw new Error(data.error || "上传失败");
      library.add(data.asset);
      onChange?.([...new Set([...value, data.asset.id])]);
      message.success("附件已上传");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Space orientation="vertical" size="small" className="w-full">
      {!disabled && (
        <Select<string>
          className="w-full"
          placeholder="复用本校已有证据（最近 200 个）"
          showSearch
          optionFilterProp="label"
          value={undefined}
          disabled={busy || value.length >= 20}
          options={library.assets
            .filter((asset) => !value.includes(asset.id))
            .map((asset) => ({ value: asset.id, label: asset.name }))}
          onChange={(id) => onChange?.([...value, id])}
        />
      )}
      <Upload
        showUploadList={false}
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        beforeUpload={(file) => {
          void upload(file);
          return Upload.LIST_IGNORE;
        }}
        disabled={disabled || busy || value.length >= 20}
      >
        <Button
          icon={<UploadOutlined />}
          loading={busy}
          disabled={disabled || value.length >= 20}
        >
          上传证据
        </Button>
      </Upload>
      {value.map((id) => (
        <Space key={id}>
          <Link href={`/api/files/${id}`} target="_blank" className="break-all">
            {[...library.assets, ...names].find((asset) => asset.id === id)
              ?.name ?? `附件 ${id.slice(0, 8)}`}
          </Link>
          {!disabled && (
            <Button
              type="link"
              size="small"
              onClick={() => onChange?.(value.filter((entry) => entry !== id))}
            >
              移除引用
            </Button>
          )}
        </Space>
      ))}
    </Space>
  );
}
