"use client";

import { useEffect, useState } from "react";
import type { DataItemCatalogQuery, DataItemList } from "@/shared/data-items";

export function useDataItemCatalog(query: DataItemCatalogQuery) {
  const [state, setState] = useState<{
    data: DataItemList | null;
    loading: boolean;
    error: string;
  }>({ data: null, loading: true, error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setState({ data: null, loading: true, error: "" });
      try {
        const params = new URLSearchParams({
          q: query.q,
          unit: query.unit,
          page: String(query.page),
          pageSize: String(query.pageSize),
        });
        const response = await fetch(`/api/data-items?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "公共数据项加载失败");
        if (!controller.signal.aborted)
          setState({ data, loading: false, error: "" });
      } catch (cause) {
        if (!controller.signal.aborted)
          setState({
            data: null,
            loading: false,
            error:
              cause instanceof Error ? cause.message : "公共数据项加载失败",
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [query.q, query.unit, query.page, query.pageSize, attempt]);
  return { ...state, retry: () => setAttempt((current) => current + 1) };
}
