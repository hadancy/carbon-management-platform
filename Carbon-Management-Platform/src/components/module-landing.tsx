"use client";

import { Card, Empty, Flex, Row, Col, Steps, Tag, Typography } from "antd";

type ModuleLandingProps = {
  index: string;
  title: string;
  description: string;
  steps: string[];
};

export function ModuleLanding({
  index,
  title,
  description,
  steps,
}: ModuleLandingProps) {
  return (
    <Flex vertical gap={26}>
      <Flex align="start" justify="space-between" gap={20} wrap>
        <Flex vertical gap={0}>
          <Typography.Text className="mb-2 text-[11px] font-bold tracking-[0.08em] text-[#409eff]">
            模块 {index} / 03
          </Typography.Text>
          <Typography.Title level={1} className="mt-0 mb-2 text-2xl">
            {title}
          </Typography.Title>
          <Typography.Paragraph
            type="secondary"
            className="m-0 leading-[1.6] text-[#909399]"
          >
            {description}
          </Typography.Paragraph>
        </Flex>
        <Tag color="default">功能开发中</Tag>
      </Flex>
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={16}>
          <Card
            className="h-full min-h-80 shadow-none max-[960px]:min-h-0 [&_.ant-empty]:mt-17.5"
            title={`${title}列表`}
          >
            <Empty description="暂无业务数据；学校权限与数据接口接入后可在此查看。" />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            className="h-full min-h-80 shadow-none max-[960px]:min-h-0"
            title="计划工作流程"
          >
            <Steps
              direction="vertical"
              size="small"
              current={-1}
              items={steps.map((step) => ({ title: step }))}
            />
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}
