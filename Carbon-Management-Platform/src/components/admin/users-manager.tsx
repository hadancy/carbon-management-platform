"use client";

import { useState } from "react";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Alert, Button, Flex, Typography } from "antd";
import type { SchoolRow } from "./schools/types";
import { AssignExistingDialog } from "./users/assign-existing-dialog";
import { UsersFilter } from "./users/users-filter";
import { UsersTable } from "./users/users-table";
import { UsersDialogs } from "./users/users-dialogs";
import { useUsersActions } from "./users/use-users-actions";
import type { SchoolOption, UserRow } from "./users/types";

export function UsersManager({
  users,
  schools,
  schoolContext,
  startCreate = false,
  onBack,
}: {
  users: UserRow[];
  schools: SchoolOption[];
  schoolContext?: SchoolRow;
  startCreate?: boolean;
  onBack?: () => void;
}) {
  const {
    createForm,
    editForm,
    membershipForm,
    passwordForm,
    assignForm,
    dialog,
    selected,
    statusTarget,
    deleteTarget,
    removeTarget,
    assignOpen,
    busy,
    error,
    setError,
    setStatusTarget,
    setDeleteTarget,
    setRemoveTarget,
    setAssignOpen,
    openDialog,
    closeDialog,
    assignExisting,
    removeSchoolMembership,
    deleteSelectedAccount,
    createAccount,
    updateAccount,
    saveMembership,
    resetPassword,
    toggleAccount,
  } = useUsersActions({ schoolContext, startCreate });
  const [keyword, setKeyword] = useState("");
  const [schoolId, setSchoolId] = useState<string | undefined>();
  const [status, setStatus] = useState<UserRow["status"] | undefined>();
  const [filters, setFilters] = useState({
    keyword: "",
    schoolId: "",
    status: "",
  });

  const visibleUsers = users.filter((user) => {
    if (
      schoolContext &&
      !user.memberships.some((item) => item.schoolId === schoolContext.id)
    )
      return false;
    const matchesKeyword =
      !filters.keyword ||
      `${user.displayName} ${user.email}`
        .toLowerCase()
        .includes(filters.keyword.toLowerCase());
    const matchesSchool =
      !filters.schoolId ||
      user.memberships.some(
        (membership) => membership.schoolId === filters.schoolId,
      );
    return (
      matchesKeyword &&
      matchesSchool &&
      (!filters.status || user.status === filters.status)
    );
  });

  function applyFilters() {
    setFilters({
      keyword: keyword.trim(),
      schoolId: schoolId ?? "",
      status: status ?? "",
    });
  }

  function resetFilters() {
    setKeyword("");
    setSchoolId(undefined);
    setStatus(undefined);
    setFilters({ keyword: "", schoolId: "", status: "" });
  }

  const title =
    dialog === "create"
      ? "新增账号"
      : dialog === "edit"
        ? "编辑账号"
        : dialog === "membership"
          ? "管理学校归属"
          : "重置密码";

  return (
    <Flex vertical gap={20} className="w-full">
      {schoolContext && onBack && (
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          className="w-fit p-0"
        >
          返回学校列表
        </Button>
      )}
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
            {schoolContext ? `${schoolContext.name} · 学校账号` : "全部账号"}
          </Typography.Title>
          <Typography.Paragraph
            type="secondary"
            className="m-0 text-[13px] text-[#909399]"
          >
            {schoolContext
              ? "管理该校账号和校内角色；账号可同时归属其他学校。"
              : "统一管理账号、登录状态与跨校归属。"}
          </Typography.Paragraph>
        </Flex>
        <Typography.Text
          type="secondary"
          className="whitespace-nowrap text-[13px] text-[#909399]"
        >
          共 {schoolContext ? visibleUsers.length : users.length} 个账号
        </Typography.Text>
      </Flex>

      {schoolContext && schoolContext.memberCount === 0 && (
        <Alert
          type="info"
          showIcon
          title="这所学校还没有账号"
          description="请新建学校管理员，或添加一位已有账号并设为学校管理员。"
        />
      )}

      {error &&
        !dialog &&
        !statusTarget &&
        !deleteTarget &&
        !removeTarget &&
        !assignOpen && (
          <Alert
            type="error"
            title={error}
            closable
            onClose={() => setError("")}
          />
        )}

      <UsersFilter
        keyword={keyword}
        setKeyword={setKeyword}
        schoolId={schoolId}
        setSchoolId={setSchoolId}
        status={status}
        setStatus={setStatus}
        schools={schools}
        fixedSchoolId={schoolContext?.id}
        applyFilters={applyFilters}
        resetFilters={resetFilters}
      />

      <UsersTable
        visibleUsers={visibleUsers}
        openDialog={openDialog}
        setError={setError}
        setStatusTarget={setStatusTarget}
        setDeleteTarget={setDeleteTarget}
        setRemoveTarget={setRemoveTarget}
        schoolId={schoolContext?.id}
        schoolActive={schoolContext?.status === "ACTIVE"}
        onAssignExisting={() => {
          setError("");
          setAssignOpen(true);
        }}
      />

      {schoolContext && (
        <AssignExistingDialog
          open={assignOpen}
          schoolName={schoolContext.name}
          candidates={users.filter(
            (user) =>
              !user.memberships.some(
                (item) => item.schoolId === schoolContext.id,
              ),
          )}
          initialRole={
            schoolContext.memberCount === 0 ? "SCHOOL_ADMIN" : "VIEWER"
          }
          form={assignForm}
          busy={busy}
          error={error}
          onCancel={() => {
            setAssignOpen(false);
            setError("");
          }}
          onFinish={assignExisting}
        />
      )}

      <UsersDialogs
        title={title}
        dialog={dialog}
        selected={selected}
        statusTarget={statusTarget}
        deleteTarget={deleteTarget}
        removeTarget={removeTarget}
        busy={busy}
        error={error}
        schools={schools}
        fixedSchool={
          schoolContext
            ? {
                id: schoolContext.id,
                name: schoolContext.name,
                status: schoolContext.status,
              }
            : undefined
        }
        createForm={createForm}
        editForm={editForm}
        membershipForm={membershipForm}
        passwordForm={passwordForm}
        createAccount={createAccount}
        updateAccount={updateAccount}
        saveMembership={saveMembership}
        resetPassword={resetPassword}
        closeDialog={closeDialog}
        toggleAccount={toggleAccount}
        deleteAccount={deleteSelectedAccount}
        removeMembership={removeSchoolMembership}
        setStatusTarget={setStatusTarget}
        setDeleteTarget={setDeleteTarget}
        setRemoveTarget={setRemoveTarget}
        setError={setError}
      />
    </Flex>
  );
}
