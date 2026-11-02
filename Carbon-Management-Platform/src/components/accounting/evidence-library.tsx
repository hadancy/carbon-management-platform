"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { App } from "antd";
import type { EvidenceAsset } from "./types";

type Library = { assets: EvidenceAsset[]; add: (asset: EvidenceAsset) => void };
const Context = createContext<Library>({ assets: [], add: () => {} });
export const useEvidenceLibrary = () => useContext(Context);
export function EvidenceLibrary({ children }: { children: React.ReactNode }) {
  const { message } = App.useApp();
  const [assets, setAssets] = useState<EvidenceAsset[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/files", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "读取附件失败");
        setAssets(data.assets);
      })
      .catch((error) => {
        if (!controller.signal.aborted) message.error(error.message);
      });
    return () => controller.abort();
  }, [message]);
  function add(asset: EvidenceAsset) {
    setAssets((previous) => [
      asset,
      ...previous.filter((item) => item.id !== asset.id),
    ]);
  }
  return (
    <Context.Provider value={{ assets, add }}>{children}</Context.Provider>
  );
}
