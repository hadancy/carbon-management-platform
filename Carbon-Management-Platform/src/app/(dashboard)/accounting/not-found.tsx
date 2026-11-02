import Link from "next/link";
import { Button, Result } from "antd";

export default function AccountingNotFound() {
  return (
    <Result
      status="404"
      title="核算案例不存在"
      subTitle="请确认案例地址和当前学校。"
      extra={
        <Button type="primary">
          <Link href="/accounting">返回案例列表</Link>
        </Button>
      }
    />
  );
}
