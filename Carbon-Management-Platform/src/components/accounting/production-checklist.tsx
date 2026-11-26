"use client";

import { useRef } from "react";
import {
  Alert,
  Button,
  Drawer,
  Form,
  Typography,
  type FormInstance,
} from "antd";
import type { ModelRow } from "@/domain/calculation/model-rows";
import type { CalculationDiagnostic } from "@/domain/calculation/pv-contract";
import { mergeCalculationDiagnostics } from "@/domain/calculation/production-readiness";
import {
  AccountingIssueList,
  accountingSection,
} from "./accounting-diagnostics";
import type { AccountingFormValues } from "./types";

const sections = [
  ["method", "基本信息与方法"],
  ["activities", "生命周期活动数据"],
  ["energy", "运行年度电量"],
] as const;

export function ProductionChecklist({
  form,
  rows,
  getIssues,
  additionalIssues,
  dirty,
  open,
  onOpen,
  onClose,
  onIssue,
}: {
  form: FormInstance<AccountingFormValues>;
  rows: readonly ModelRow[];
  getIssues: (values: AccountingFormValues) => CalculationDiagnostic[];
  additionalIssues: CalculationDiagnostic[];
  dirty: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onIssue: (issue: CalculationDiagnostic) => void;
}) {
  const watched = Form.useWatch((values) => values, { form, preserve: true });
  const values = watched ?? form.getFieldsValue(true);
  const current = getIssues(values);
  const currentPaths = new Set(current.map((issue) => issue.path));
  const problems = mergeCalculationDiagnostics(
    current,
    additionalIssues.filter(
      (issue) => issue.code !== "FORM_FIELD" || !currentPaths.has(issue.path),
    ),
  );
  const pendingIssue = useRef<CalculationDiagnostic | null>(null);
  return (
    <>
      <Button onClick={onOpen}>
        正式计算检查{problems.length ? `（${problems.length} 项待补）` : ""}
      </Button>
      <Drawer
        title={
          problems.length
            ? `正式计算检查 · ${problems.length} 项待补`
            : "正式计算检查"
        }
        open={open}
        onClose={onClose}
        afterOpenChange={(visible) => {
          if (!visible && pendingIssue.current) {
            const issue = pendingIssue.current;
            pendingIssue.current = null;
            onIssue(issue);
          }
        }}
      >
        {dirty && (
          <Alert
            type="info"
            showIcon
            className="mb-4"
            title="完成修改后，请先保存草稿再正式计算"
          />
        )}
        {problems.length === 0 && (
          <Alert type="success" showIcon title="当前已补齐正式计算资料" />
        )}
        {sections.map(([section, title]) => {
          const group = problems.filter(
            (issue) => accountingSection(issue.path) === section,
          );
          return (
            group.length > 0 && (
              <section className="mb-4" key={section}>
                <Typography.Title level={5}>
                  {title}（{group.length} 项）
                </Typography.Title>
                <AccountingIssueList
                  problems={group}
                  rows={rows}
                  annual={values.annualEnergy ?? []}
                  onIssue={(issue) => {
                    pendingIssue.current = issue;
                    onClose();
                  }}
                />
              </section>
            )
          );
        })}
      </Drawer>
    </>
  );
}
