import "dotenv/config";
import { db } from "../src/server/db/client";
import { syncPublishedDataItemModels } from "../src/server/data-items/service";

async function main() {
  const [inputCode, email, ...extra] = process.argv.slice(2);
  if (!inputCode || extra.length)
    throw new Error(
      "用法：npm run data-items:sync -- 数据项编码 [平台管理员邮箱]",
    );

  const administrators = await db.user.findMany({
    where: {
      email,
      status: "ACTIVE",
      deletedAt: null,
      OR: [{ banned: null }, { banned: false }],
      platformRoles: { some: { role: "SUPER_ADMIN", status: "ACTIVE" } },
    },
    select: { id: true, email: true, displayName: true, role: true },
  });
  const active = administrators.filter(({ role }) =>
    role?.split(",").includes("admin"),
  );
  if (active.length !== 1) throw new Error("请指定唯一有效的平台管理员邮箱");
  const [actor] = active;
  const { entry, modelChanges } = await syncPublishedDataItemModels(
    {
      userId: actor.id,
      email: actor.email,
      displayName: actor.displayName,
      isPlatformAdmin: true,
    },
    inputCode.trim().toUpperCase(),
  );
  console.log(
    JSON.stringify({
      code: entry.dataItem.code,
      version: entry.version,
      draftsUpdated: modelChanges.filter(
        ({ createdDraft, updated }) => !createdDraft && updated > 0,
      ).length,
      draftsCreated: modelChanges.filter(({ createdDraft }) => createdDraft)
        .length,
      draftsToReview: modelChanges.filter(({ needsReview }) => needsReview > 0)
        .length,
      awaitingReview: modelChanges.filter(
        ({ awaitingReview }) => awaitingReview,
      ).length,
    }),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "补同步失败");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
