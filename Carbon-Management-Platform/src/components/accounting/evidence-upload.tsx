"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { App, Button, Select, Space, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { MAX_EVIDENCE_ASSETS } from "@/shared/accounting";
import { useEvidenceLibrary } from "./evidence-library";
import type { EvidenceAsset } from "./types";

export function EvidenceUpload({
  id,
  value = [],
  onChange,
  onUploadBusyChange,
  disabled = false,
}: {
  id?: string;
  value?: string[];
  onChange?: (ids: string[]) => void;
  onUploadBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const library = useEvidenceLibrary();
  const [names, setNames] = useState<EvidenceAsset[]>([]);
  const latestValue = useRef(value);
  useEffect(() => {
    latestValue.current = value;
  }, [value]);
  const idsKey = value
    .filter((id) => !library.assets.some((asset) => asset.id === id))
    .join(",");
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
    onUploadBusyChange?.(true);
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
      if (latestValue.current.length < MAX_EVIDENCE_ASSETS) {
        onChange?.([...latestValue.current, data.asset.id]);
        message.success("附件已上传");
      } else {
        message.warning("附件已上传到证据库，当前记录的附件已达上限");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setBusy(false);
      onUploadBusyChange?.(false);
    }
  }
  return (
    <Space orientation="vertical" size="small" className="w-full">
      {!disabled && (
        <Select<string>
          id={id}
          className="w-full"
          placeholder="复用本校已有证据（最近 200 个）"
          showSearch={{ optionFilterProp: "label" }}
          value={undefined}
          disabled={busy || value.length >= MAX_EVIDENCE_ASSETS}
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
        disabled={disabled || busy || value.length >= MAX_EVIDENCE_ASSETS}
      >
        <Button
          icon={<UploadOutlined />}
          loading={busy}
          disabled={disabled || value.length >= MAX_EVIDENCE_ASSETS}
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
