"use client";

import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  Layout,
  Row,
  Typography,
} from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(values: { email: string; password: string }) {
    setError("");
    setLoading(true);
    try {
      const result = await authClient.signIn.email({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      if (result.error) {
        setError("账号或密码错误，或账号已停用。");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("登录暂时不可用，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout.Content
      role="main"
      className="min-h-screen bg-[linear-gradient(120deg,#304156_0%,#3b5876_55%,#eef2f6_55%)] p-[clamp(30px,7vw,120px)] max-[850px]:bg-none max-[850px]:bg-[#eef2f6]"
    >
      <Row
        align="middle"
        gutter={[60, 28]}
        className="min-h-[calc(100vh-2*clamp(30px,7vw,120px))] max-[850px]:min-h-0"
      >
        <Col xs={24} lg={14}>
          <Flex vertical className="text-white max-[850px]:text-[#304156]">
            <Avatar
              shape="square"
              size={58}
              className="mb-12 bg-[#409eff] text-[34px] font-extrabold text-white max-[850px]:mb-5"
            >
              C
            </Avatar>
            <Typography.Text className="text-xs tracking-[0.18em] text-[#bfd0e1] max-[850px]:text-[#606266]">
              CARBON MANAGEMENT
            </Typography.Text>
            <Typography.Title
              level={1}
              className="my-3.5 text-[clamp(38px,5vw,62px)] text-inherit"
            >
              碳管理平台
            </Typography.Title>
            <Typography.Paragraph className="text-base leading-[1.7] text-[#e3edf8] max-[850px]:text-[#606266]">
              面向学校的碳足迹模型、核算和报告工作空间。
            </Typography.Paragraph>
          </Flex>
        </Col>
        <Col xs={24} lg={10}>
          <Card className="shadow-[0_25px_70px_rgb(24_45_66/16%)]">
            <Typography.Title level={2} className="my-1 text-2xl">
              登录
            </Typography.Title>
            <Typography.Paragraph
              type="secondary"
              className="mb-6.5 text-[#909399]"
            >
              学校账号登录入口
            </Typography.Paragraph>
            <Alert
              type="info"
              showIcon
              title="使用平台开通的账号登录"
              description="如尚无账号，请联系平台管理员为学校创建账号。"
              className="mb-6"
            />
            {error && <Alert type="error" title={error} className="mb-6" />}
            <Form layout="vertical" onFinish={signIn}>
              <Form.Item
                label="邮箱"
                name="email"
                rules={[{ required: true, type: "email" }]}
              >
                <Input placeholder="请输入邮箱" autoComplete="username" />
              </Form.Item>
              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true }]}
              >
                <Input.Password
                  placeholder="请输入密码"
                  autoComplete="current-password"
                />
              </Form.Item>
              <Button type="primary" block htmlType="submit" loading={loading}>
                登录
              </Button>
            </Form>
            <Typography.Paragraph className="mt-5.5 text-center text-[#409eff]">
              登录后按学校权限进入工作台
            </Typography.Paragraph>
          </Card>
        </Col>
      </Row>
    </Layout.Content>
  );
}
