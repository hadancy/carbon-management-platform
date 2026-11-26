import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Principal } from "@/server/auth/access";
import type { SchoolContext } from "@/server/auth/school-context";
import { calculatePv } from "@/domain/calculation/pv";
import { modelRows } from "@/domain/calculation/model-rows";
import {
  mergeCalculationDiagnostics,
  productionReadiness,
} from "@/domain/calculation/production-readiness";
import { db } from "@/server/db/client";
import { audit } from "@/server/admin/audit";
import { RequestError } from "@/server/http/response";
import { accountingInputsSchema } from "@/shared/accounting";
import { pvRuleSchema } from "@/shared/calculation-rule";
import { calculationFactorSchema } from "@/shared/emission-factors";
import { requireAccountingPermission } from "./context";
import { getCase } from "./cases";
import { inputHash, resolveSnapshot } from "./snapshot";

export async function runCalculation(
  principal: Principal,
  context: SchoolContext,
  caseId: string,
  requestId: string,
  mode: "TRIAL" | "PRODUCTION",
) {
  requireAccountingPermission(context.role, "accounting.write");
  const entry = await getCase(context.schoolId, caseId);
  const revision = entry.revisions.find(
    (item) => item.id === entry.currentRevisionId,
  );
  if (!revision || revision.status !== "DRAFT")
    throw new RequestError("当前修订不可计算", 409);
  const inputs = accountingInputsSchema.parse(revision.inputs);
  const { calculation, modelVersion, factors, publicFactors } =
    await resolveSnapshot(
      context.schoolId,
      revision.modelVersionId,
      inputs,
      mode,
      revision.scenario as "GRID_ONLY" | "DIRECT_ONLY" | "MIXED",
    );
  const ids = [
    ...new Set([
      ...inputs.lines.flatMap((line) => line.evidenceAssetIds),
      ...inputs.annualEnergy.flatMap((item) => item.evidenceAssetIds),
    ]),
  ];
  const assets = await db.fileAsset.findMany({
    where: { schoolId: context.schoolId, id: { in: ids } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      contentHash: true,
      name: true,
      mediaType: true,
      size: true,
    },
  });
  if (mode === "TRIAL" && assets.length !== ids.length)
    throw new RequestError("部分证据附件不存在或不属于本校", 400);
  const rule = revision.ruleVersionId
    ? await db.publicDataVersion.findFirst({
        where: {
          id: revision.ruleVersionId,
          type: "RULE_CONFIG",
          status: "PUBLISHED",
        },
      })
    : null;
  if (mode === "TRIAL" && revision.ruleVersionId && !rule)
    throw new RequestError("规则版本未发布", 400);
  if (mode === "PRODUCTION") {
    const parsedRule = pvRuleSchema.safeParse(rule?.content);
    const readiness = productionReadiness(inputs, {
      rows: modelRows(modelVersion.content),
      ruleVersionId: revision.ruleVersionId,
      rule: parsedRule.success ? parsedRule.data : null,
      factors: new Map(
        publicFactors.map((factor) => {
          const parsed = calculationFactorSchema.safeParse(factor.content);
          return [factor.id, parsed.success ? parsed.data : null];
        }),
      ),
      availableAssetIds: new Set(assets.map((asset) => asset.id)),
    });
    if (readiness.requirements.length) {
      const covered = new Set(readiness.requirements.map((item) => item.path));
      return {
        run: null,
        preflightError: "请补齐正式计算资料",
        diagnostics: mergeCalculationDiagnostics(
          readiness.requirements,
          readiness.problems,
          calculatePv(calculation).diagnostics.filter(
            (item) => !covered.has(item.path),
          ),
        ),
      };
    }
  }
  const snapshot = {
    modelVersion,
    factors,
    inputs,
    assets,
    ruleVersion: rule && {
      id: rule.id,
      code: rule.code,
      version: rule.version,
      content: rule.content,
    },
    scenario: revision.scenario,
    mode,
  };
  const hash = inputHash({ inputRevision: revision.inputRevision, snapshot });
  const existing = await db.calculationRun.findUnique({
    where: { revisionId_requestId: { revisionId: revision.id, requestId } },
  });
  if (existing) {
    if (existing.inputHash !== hash)
      throw new RequestError("请求标识已用于不同输入", 409);
    return { run: existing, diagnostics: [] };
  }
  const outcome = calculatePv(calculation);
  if (!outcome.ok) return { run: null, diagnostics: outcome.diagnostics };
  try {
    const run = await db.$transaction(async (tx) => {
      const fresh = await tx.accountingRevision.findFirst({
        where: {
          id: revision.id,
          schoolId: context.schoolId,
          status: "DRAFT",
          inputRevision: revision.inputRevision,
        },
      });
      if (!fresh) throw new RequestError("输入已变化，请重新计算", 409);
      const created = await tx.calculationRun.create({
        data: {
          revisionId: revision.id,
          schoolId: context.schoolId,
          inputRevision: revision.inputRevision,
          requestId,
          inputHash: hash,
          engineVersion: outcome.result.engineVersion,
          schemaVersion: 1,
          mode,
          snapshots: snapshot as Prisma.InputJsonValue,
          result: outcome.result as unknown as Prisma.InputJsonValue,
          createdById: principal.userId,
        },
      });
      await audit(tx, {
        actorId: principal.userId,
        schoolId: context.schoolId,
        action: "accounting.calculate",
        targetType: "CalculationRun",
        targetId: created.id,
        details: { caseId, mode, inputHash: hash },
      });
      return created;
    });
    return { run, diagnostics: [] };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const run = await db.calculationRun.findUnique({
        where: { revisionId_requestId: { revisionId: revision.id, requestId } },
      });
      if (run && run.inputHash === hash) return { run, diagnostics: [] };
      throw new RequestError("请求标识已用于不同输入", 409);
    }
    throw error;
  }
}
