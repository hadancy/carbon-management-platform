import { Alert, Modal, Typography } from "antd";
import type { FormInstance } from "antd";
import type {
  AccountForm,
  Dialog,
  MembershipForm,
  SchoolOption,
  UserRow,
} from "./types";
import { CreateAccountForm } from "./create-account-form";
import { EditAccountForm } from "./edit-account-form";
import { SchoolMembershipForm } from "./school-membership-form";
import { PasswordResetForm } from "./password-reset-form";

type Props = {
  title: string;
  dialog: Dialog;
  selected: UserRow | null;
  statusTarget: UserRow | null;
  deleteTarget: UserRow | null;
  removeTarget: UserRow | null;
  busy: boolean;
  error: string;
  schools: SchoolOption[];
  fixedSchool?: SchoolOption;
  createForm: FormInstance<AccountForm>;
  editForm: FormInstance<{ displayName: string }>;
  membershipForm: FormInstance<MembershipForm>;
  passwordForm: FormInstance<{ newPassword: string }>;
  createAccount: (values: AccountForm) => Promise<void>;
  updateAccount: (values: { displayName: string }) => Promise<void>;
  saveMembership: (values: MembershipForm) => Promise<void>;
  resetPassword: (values: { newPassword: string }) => Promise<void>;
  closeDialog: () => void;
  toggleAccount: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  removeMembership: () => Promise<void>;
  setStatusTarget: (user: UserRow | null) => void;
  setDeleteTarget: (user: UserRow | null) => void;
  setRemoveTarget: (user: UserRow | null) => void;
  setError: (value: string) => void;
};

export function UsersDialogs({
  title,
  dialog,
  selected,
  statusTarget,
  deleteTarget,
  removeTarget,
  busy,
  error,
  schools,
  fixedSchool,
  createForm,
  editForm,
  membershipForm,
  passwordForm,
  createAccount,
  updateAccount,
  saveMembership,
  resetPassword,
  closeDialog,
  toggleAccount,
  deleteAccount,
  removeMembership,
  setStatusTarget,
  setDeleteTarget,
  setRemoveTarget,
  setError,
}: Props) {
  return (
    <>
      <Modal
        title={title}
        open={!!dialog}
        onCancel={closeDialog}
        onOk={() => {
          if (dialog === "create") createForm.submit();
          if (dialog === "edit") editForm.submit();
          if (dialog === "membership") membershipForm.submit();
          if (dialog === "password") passwordForm.submit();
        }}
        confirmLoading={busy}
        okText={dialog === "password" ? "确认重置" : "保存"}
        cancelText="取消"
        destroyOnHidden
      >
        {error && <Alert type="error" title={error} className="my-4" />}
        {dialog === "create" && (
          <CreateAccountForm
            createForm={createForm}
            createAccount={createAccount}
            schools={schools}
            fixedSchool={fixedSchool}
          />
        )}
        {dialog === "edit" && selected && (
          <EditAccountForm
            selected={selected}
            editForm={editForm}
            updateAccount={updateAccount}
          />
        )}
        {dialog === "membership" && selected && (
          <SchoolMembershipForm
            selected={selected}
            schools={schools}
            fixedSchool={fixedSchool}
            membershipForm={membershipForm}
            saveMembership={saveMembership}
          />
        )}
        {dialog === "password" && selected && (
          <PasswordResetForm
            selected={selected}
            passwordForm={passwordForm}
            resetPassword={resetPassword}
          />
        )}
      </Modal>

      <Modal
        title="删除账号"
        open={!!deleteTarget}
        onCancel={() => {
          setDeleteTarget(null);
          setError("");
        }}
        onOk={deleteAccount}
        confirmLoading={busy}
        okText="确认删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        {error && <Alert type="error" title={error} className="my-4" />}
        <Typography.Paragraph>
          删除「{deleteTarget?.displayName}
          」后，该账号将无法登录，并从所有学校移除。此操作无法撤销。
        </Typography.Paragraph>
      </Modal>

      <Modal
        title="移除学校归属"
        open={!!removeTarget}
        onCancel={() => {
          setRemoveTarget(null);
          setError("");
        }}
        onOk={removeMembership}
        confirmLoading={busy}
        okText="确认移除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        {error && <Alert type="error" title={error} className="my-4" />}
        <Typography.Paragraph>
          将「{removeTarget?.displayName}」从「{fixedSchool?.name}
          」移除？该账号在其他学校的归属不受影响。
        </Typography.Paragraph>
      </Modal>

      <Modal
        title={statusTarget?.status === "ACTIVE" ? "停用账号" : "启用账号"}
        open={!!statusTarget}
        onCancel={() => {
          setStatusTarget(null);
          setError("");
        }}
        onOk={toggleAccount}
        confirmLoading={busy}
        okText="确认"
        cancelText="取消"
      >
        {error && <Alert type="error" title={error} className="my-4" />}
        <Typography.Paragraph>
          {statusTarget?.status === "ACTIVE"
            ? "停用后，该账号将无法登录，已有会话也会失效。"
            : "启用后，该账号可以重新登录。"}
        </Typography.Paragraph>
      </Modal>
    </>
  );
}
