"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { App, Form } from "antd";
import { adminRequest } from "../api";
import type { SchoolRow } from "../schools/types";
import type { AssignExistingForm } from "./assign-existing-dialog";
import type { AccountForm, Dialog, MembershipForm, UserRow } from "./types";

export function useUsersActions({
  schoolContext,
  startCreate,
}: {
  schoolContext?: SchoolRow;
  startCreate: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [createForm] = Form.useForm<AccountForm>();
  const [editForm] = Form.useForm<{ displayName: string }>();
  const [membershipForm] = Form.useForm<MembershipForm>();
  const [passwordForm] = Form.useForm<{ newPassword: string }>();
  const [assignForm] = Form.useForm<AssignExistingForm>();
  const [dialog, setDialog] = useState<Dialog>(startCreate ? "create" : null);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [statusTarget, setStatusTarget] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [removeTarget, setRemoveTarget] = useState<UserRow | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function openDialog(
    next: Exclude<Dialog, null>,
    user: UserRow | null = null,
  ) {
    setError("");
    setSelected(user);
    setDialog(next);
  }

  function closeDialog() {
    setDialog(null);
    setSelected(null);
    setError("");
    if (startCreate && schoolContext) {
      router.replace(`/admin/schools?schoolId=${schoolContext.id}`);
    }
  }

  async function assignExisting(values: AssignExistingForm) {
    if (!schoolContext) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest("/api/admin/memberships", "POST", {
        ...values,
        schoolId: schoolContext.id,
        status: "ACTIVE",
      });
      setAssignOpen(false);
      message.success("账号已添加到学校");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "添加账号失败");
    } finally {
      setBusy(false);
    }
  }

  async function removeSchoolMembership() {
    if (!schoolContext || !removeTarget) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest("/api/admin/memberships", "DELETE", {
        userId: removeTarget.id,
        schoolId: schoolContext.id,
      });
      setRemoveTarget(null);
      message.success("学校归属已移除");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "移除学校归属失败");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedAccount() {
    if (!deleteTarget || deleteTarget.isPlatformAdmin) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(`/api/admin/users/${deleteTarget.id}`, "DELETE");
      setDeleteTarget(null);
      message.success("账号已删除");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除账号失败");
    } finally {
      setBusy(false);
    }
  }

  async function createAccount(values: AccountForm) {
    setBusy(true);
    setError("");
    try {
      await adminRequest("/api/admin/users", "POST", values);
      closeDialog();
      message.success("账号已创建");
      if (!startCreate) router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建账号失败");
    } finally {
      setBusy(false);
    }
  }

  async function updateAccount(values: { displayName: string }) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(`/api/admin/users/${selected.id}`, "PATCH", values);
      closeDialog();
      message.success("账号信息已更新");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新账号失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveMembership(values: MembershipForm) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest("/api/admin/memberships", "POST", {
        userId: selected.id,
        ...values,
      });
      closeDialog();
      message.success("学校归属已保存");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存学校归属失败");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(values: { newPassword: string }) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(
        `/api/admin/users/${selected.id}/password`,
        "POST",
        values,
      );
      closeDialog();
      message.success("密码已重置，原有登录会话已撤销");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "重置密码失败");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAccount() {
    if (!statusTarget) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(`/api/admin/users/${statusTarget.id}`, "PATCH", {
        status: statusTarget.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });
      message.success(
        statusTarget.status === "ACTIVE" ? "账号已停用" : "账号已启用",
      );
      setStatusTarget(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新账号状态失败");
    } finally {
      setBusy(false);
    }
  }

  return {
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
  };
}
