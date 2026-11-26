"use client";

import { useEffect, useState } from "react";
import type { DataItemCatalogQuery, DataItemList } from "@/shared/data-items";

export function useDataItemCatalog(query: DataItemCatalogQuery) {
  const params = new URLSearchParams({
    q: query.q,
    unit: query.unit,
    page: String(query.page),
    pageSize: String(query.pageSize),
  }).toString();
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${attempt}:${params}`;
  const [state, setState] = useState<{
    requestKey: string;
    data: DataItemList | null;
    loading: boolean;
    error: string;
  }>({ requestKey, data: null, loading: true, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setState({ requestKey, data: null, loading: true, error: "" });
      try {
        const response = await fetch(`/api/data-items?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "公共数据项加载失败");
        if (!controller.signal.aborted)
          setState({ requestKey, data, loading: false, error: "" });
      } catch (cause) {
        if (!controller.signal.aborted)
          setState({
            requestKey,
            data: null,
            loading: false,
            error:
              cause instanceof Error ? cause.message : "公共数据项加载失败",
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [params, requestKey]);
  // Effects run after rendering; never pair a new query with the previous result.
  const isCurrentRequest = state.requestKey === requestKey;
  return {
    data: isCurrentRequest ? state.data : null,
    loading: !isCurrentRequest || state.loading,
    error: isCurrentRequest ? state.error : "",
    retry: () => setAttempt((current) => current + 1),
  };
}
