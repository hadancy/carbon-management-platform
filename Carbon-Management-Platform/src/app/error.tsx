"use client";

import { Button, Result } from "antd";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Result
      status="error"
      title="页面暂时无法显示"
      subTitle="请重试；如果问题持续，请联系管理员。"
      extra={<Button onClick={reset}>重试</Button>}
    />
  );
}
