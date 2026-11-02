import "server-only";
import { createHash } from "node:crypto";
import type { Principal } from "@/server/auth/access";
import type { SchoolContext } from "@/server/auth/school-context";
import { db } from "@/server/db/client";
import { RequestError } from "@/server/http/response";
import { requireAccountingPermission } from "@/server/accounting/context";
import { audit } from "@/server/admin/audit";

const allowed = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const maximumSize = 5 * 1024 * 1024;

function validSignature(bytes: Uint8Array, type: string) {
  const prefix = Buffer.from(bytes.subarray(0, 12));
  if (type === "application/pdf")
    return prefix.subarray(0, 5).toString() === "%PDF-";
  if (type === "image/png")
    return prefix
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/jpeg")
    return prefix[0] === 255 && prefix[1] === 216 && prefix[2] === 255;
  if (type === "image/webp")
    return (
      prefix.subarray(0, 4).toString() === "RIFF" &&
      prefix.subarray(8, 12).toString() === "WEBP"
    );
  return false;
}

export async function uploadAsset(
  principal: Principal,
  context: SchoolContext,
  file: File,
) {
  requireAccountingPermission(context.role, "accounting.write");
  if (!allowed.has(file.type) || file.size < 1 || file.size > maximumSize)
    throw new RequestError("仅支持不超过 5 MB 的 PDF、PNG、JPG 或 WebP", 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validSignature(bytes, file.type))
    throw new RequestError("文件内容与类型不符", 400);
  const name =
    file.name.replace(/[\\/\r\n\x00-\x1f]/g, "_").slice(0, 255) || "证据附件";
  return db.$transaction(async (tx) => {
    const asset = await tx.fileAsset.create({
      data: {
        schoolId: context.schoolId,
        uploadedById: principal.userId,
        name,
        mediaType: file.type,
        size: bytes.length,
        contentHash: createHash("sha256").update(bytes).digest("hex"),
        content: bytes,
      },
      select: {
        id: true,
        name: true,
        mediaType: true,
        size: true,
        contentHash: true,
        createdAt: true,
      },
    });
    await audit(tx, {
      actorId: principal.userId,
      schoolId: context.schoolId,
      action: "accounting.evidence.upload",
      targetType: "FileAsset",
      targetId: asset.id,
      details: {
        contentHash: asset.contentHash,
        mediaType: asset.mediaType,
        size: asset.size,
      },
    });
    return asset;
  });
}

export async function getAsset(schoolId: string, id: string) {
  const asset = await db.fileAsset.findFirst({ where: { id, schoolId } });
  if (!asset) throw new RequestError("附件不存在", 404);
  return asset;
}

export async function listAssets(schoolId: string, ids?: string[]) {
  return db.fileAsset.findMany({
    where: { schoolId, ...(ids ? { id: { in: ids } } : {}) },
    select: {
      id: true,
      name: true,
      mediaType: true,
      size: true,
      contentHash: true,
    },
    orderBy: { createdAt: "desc" },
    take: ids ? 20 : 200,
  });
}
