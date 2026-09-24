"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, App, Flex, Form, Typography } from "antd";
import { adminRequest } from "./api";
import { SchoolsFilter } from "./schools/schools-filter";
import { SchoolsTable } from "./schools/schools-table";
import { SchoolDialog } from "./schools/school-dialog";
import type { SchoolForm, SchoolRow } from "./schools/types";

export function SchoolsManager({
  schools,
  onManageAccounts,
  onCreated,
}: {
  schools: SchoolRow[];
  onManageAccounts: (school: SchoolRow) => void;
  onCreated: (schoolId: string) => void;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<SchoolForm>();
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<SchoolRow["status"] | undefined>();
  const [filters, setFilters] = useState({ keyword: "", status: "" });
  const [selected, setSelected] = useState<SchoolRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!modalOpen) return;
    form.resetFields();
    form.setFieldsValue({
      code: selected?.code ?? "",
      name: selected?.name ?? "",
    });
  }, [form, modalOpen, selected]);

  const visibleSchools = schools.filter((school) => {
    const matchesKeyword =
      !filters.keyword ||
      `${school.code} ${school.name}`
        .toLowerCase()
        .includes(filters.keyword.toLowerCase());
    return (
      matchesKeyword && (!filters.status || school.status === filters.status)
    );
  });

  function applyFilters() {
    setFilters({ keyword: keyword.trim(), status: status ?? "" });
  }

  function resetFilters() {
    setKeyword("");
    setStatus(undefined);
    setFilters({ keyword: "", status: "" });
  }

  function openModal(school: SchoolRow | null) {
    setError("");
    setSelected(school);
    setModalOpen(true);
  }

  async function save(values: SchoolForm) {
    setBusy(true);
    setError("");
    try {
      if (selected) {
        await adminRequest(`/api/admin/schools/${selected.id}`, "PATCH", {
          name: values.name,
        });
      } else {
        const result = await adminRequest<{ school: { id: string } }>(
          "/api/admin/schools",
          "POST",
          values,
        );
        onCreated(result.school.id);
      }
      setModalOpen(false);
      form.resetFields();
      message.success(selected ? "学校信息已更新" : "学校已创建");
      if (selected) router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存学校失败");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(school: SchoolRow) {
    setStatusBusyId(school.id);
    setError("");
    try {
      await adminRequest(`/api/admin/schools/${school.id}`, "PATCH", {
        status: school.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });
      message.success(school.status === "ACTIVE" ? "学校已停用" : "学校已启用");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新学校状态失败");
    } finally {
      setStatusBusyId(null);
    }
  }

  return (
    <Flex vertical gap={20} className="w-full">
      <Flex
        align="end"
        justify="space-between"
        className="gap-4 max-[650px]:flex-col max-[650px]:items-start max-[650px]:gap-0"
      >
        <Flex vertical gap={0}>
          <Typography.Title
            level={2}
            className="mt-0 mb-1 text-xl font-semibold"
          >
            学校管理
          </Typography.Title>
          <Typography.Paragraph
            type="secondary"
            className="m-0 text-[13px] text-[#909399]"
          >
            查看学校、筛选状态，并在弹窗中维护学校信息。
          </Typography.Paragraph>
        </Flex>
        <Typography.Text
          type="secondary"
          className="whitespace-nowrap text-[13px] text-[#909399]"
        >
          共 {schools.length} 所学校
        </Typography.Text>
      </Flex>

      {error && !modalOpen && (
        <Alert
          type="error"
          title={error}
          closable
          onClose={() => setError("")}
        />
      )}

      <SchoolsFilter
        keyword={keyword}
        setKeyword={setKeyword}
        status={status}
        setStatus={setStatus}
        applyFilters={applyFilters}
        resetFilters={resetFilters}
      />

      <SchoolsTable
        visibleSchools={visibleSchools}
        openModal={openModal}
        onManageAccounts={onManageAccounts}
        toggleStatus={toggleStatus}
        statusBusyId={statusBusyId}
      />

      <SchoolDialog
        selected={selected}
        modalOpen={modalOpen}
        close={() => {
          setModalOpen(false);
          setError("");
        }}
        form={form}
        save={save}
        busy={busy}
        error={error}
      />
    </Flex>
  );
}
