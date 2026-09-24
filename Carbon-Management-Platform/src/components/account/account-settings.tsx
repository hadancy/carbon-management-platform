"use client";

import { useState } from "react";
import { Alert, Button, Card, Form, Input } from "antd";
import { authClient } from "@/lib/auth-client";

export function AccountSettings() {
  const [form] = Form.useForm();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function changePassword(values: {
    currentPassword: string;
    newPassword: string;
  }) {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const result = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setError("密码修改失败，请检查当前密码与新密码。");
      } else {
        form.resetFields();
        setMessage("密码已更新，其他登录会话已失效。");
      }
    } catch {
      setError("密码修改暂时不可用。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="账号设置" className="max-w-140">
      {message && <Alert type="success" title={message} className="mb-5" />}
      {error && <Alert type="error" title={error} className="mb-5" />}
      <Form form={form} layout="vertical" onFinish={changePassword}>
        <Form.Item
          label="当前密码"
          name="currentPassword"
          rules={[{ required: true }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          label="新密码"
          name="newPassword"
          rules={[{ required: true, min: 12, message: "新密码至少 12 位" }]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          更新密码
        </Button>
      </Form>
    </Card>
  );
}
