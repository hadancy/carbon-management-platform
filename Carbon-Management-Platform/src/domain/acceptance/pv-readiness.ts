import { z } from "zod";
import type { PvAcceptanceBundle } from "./pv-contract";

export function checkPvBusinessReadiness(
  bundle: PvAcceptanceBundle,
  scopeHash: string,
  verifiedEvidenceIds: ReadonlySet<string>,
) {
  const { snapshot, expected } = bundle;
  const blockers: string[] = [];
  const evidenceIds = new Set(bundle.evidence.map((entry) => entry.id));
  const evidence = (id: string) =>
    evidenceIds.has(id) && verifiedEvidenceIds.has(id);
  if (evidenceIds.size !== bundle.evidence.length)
    blockers.push("证据编号重复");
  if (bundle.caseKind !== "BUSINESS")
    blockers.push("合成或公开参考样例仅构成工程验证，不能完成 T06 业务验收");
  if (
    snapshot.mode !== "PRODUCTION" ||
    snapshot.ruleVersion.content.purpose !== "PRODUCTION"
  )
    blockers.push("业务验收须绑定正式运行及正式规则版本");
  const rule = snapshot.ruleVersion.content;
  if (
    snapshot.inputs.referenceDate < rule.effectiveFrom ||
    snapshot.inputs.referenceDate > rule.effectiveTo
  )
    blockers.push("规则不适用于案例核算日期");
  if (!bundle.run) blockers.push("缺少已保存的正式运行记录");
  if (!evidence(expected.evidenceId))
    blockers.push("缺少已核对摘要的独立手算或外部工具证据");
  for (const entry of bundle.evidence)
    if (!verifiedEvidenceIds.has(entry.id))
      blockers.push(`证据未核对或摘要不符：${entry.id}`);
  const usedFactors = new Set(
    snapshot.inputs.lines
      .filter((line) => line.state === "RECORDED")
      .map((line) => line.factorVersionId),
  );
  if (
    snapshot.factors.some(
      (factor) =>
        usedFactors.has(factor.id) && factor.content.purpose !== "PRODUCTION",
    )
  )
    blockers.push("测试因子不能作为正式验收依据");
  const gridItem =
    snapshot.modelVersion.content.calculationProfile?.itemMappings.find(
      (item) => item.role === "GRID_FACTOR",
    )?.itemId;
  const assetIds = new Set(snapshot.assets.map((asset) => asset.id));
  const requiredAssets = [
    ...snapshot.inputs.lines.filter(
      (line) => line.state === "RECORDED" && line.itemId !== gridItem,
    ),
    ...snapshot.inputs.annualEnergy,
  ];
  if (
    requiredAssets.some(
      (item) =>
        !item.evidenceAssetIds.length ||
        item.evidenceAssetIds.some((id) => !assetIds.has(id)),
    )
  )
    blockers.push("活动或电量凭证缺失，或未包含在运行证据快照中");
  for (const asset of snapshot.assets)
    if (
      !bundle.evidence.some(
        (entry) => entry.sha256 === asset.contentHash && evidence(entry.id),
      )
    )
      blockers.push(`运行附件缺少实际文件校验：${asset.id}`);
  const inputs = snapshot.inputs;
  if (
    !inputs.specification ||
    !inputs.projectLocation ||
    !inputs.boundaryNote ||
    inputs.exclusionNote !== "无" ||
    inputs.measurementUnit !== "kWh" ||
    !z.iso.date().safeParse(inputs.collectionStart).success ||
    !z.iso.date().safeParse(inputs.collectionEnd).success ||
    inputs.collectionStart > inputs.collectionEnd
  )
    blockers.push("案例规格、地点、采集期间、边界或无取舍声明不完整");
  if (
    inputs.lines.some(
      (line) =>
        line.state === "RECORDED" &&
        line.itemId !== gridItem &&
        (!line.location?.trim() ||
          !line.process?.trim() ||
          !line.measurementMethod?.trim() ||
          !line.sourceType ||
          (line.sourceType === "ESTIMATED" && !line.estimationMethod?.trim())),
    )
  )
    blockers.push("活动数据缺少地点、工艺、计量方式或估算依据");
  for (const id of ["B01", "B02", "B03", "B04", "B05", "B06"] as const) {
    const records = bundle.decisions.filter((item) => item.id === id);
    const decision = records[0];
    if (
      records.length !== 1 ||
      decision.status !== "CONFIRMED" ||
      !decision.conclusion.trim() ||
      !decision.confirmedBy.trim() ||
      !decision.confirmedAt ||
      !decision.evidenceIds.length ||
      decision.evidenceIds.some((ref) => !evidence(ref)) ||
      decision.scopeHash !== scopeHash
    )
      blockers.push(`${id} 缺少与当前验收范围绑定的业务结论、签认人与证据`);
  }
  const signoff = bundle.signoff;
  if (
    !signoff.preparedBy.trim() ||
    !signoff.reviewedBy.trim() ||
    signoff.preparedBy.trim() === signoff.reviewedBy.trim() ||
    !signoff.acceptedBy.trim() ||
    !signoff.acceptedAt ||
    !evidence(signoff.evidenceId) ||
    signoff.scopeHash !== scopeHash
  )
    blockers.push("缺少独立复核人、业务验收人或当前范围的签认资料");
  for (const id of [
    "REVIEW_REVISION",
    "CROSS_SCHOOL",
    "HISTORY_FROZEN",
  ] as const) {
    const records = bundle.workflow.filter((item) => item.id === id);
    if (
      records.length !== 1 ||
      records[0].status !== "PASS" ||
      !evidence(records[0].evidenceId) ||
      records[0].scopeHash !== scopeHash
    )
      blockers.push(`${id} 缺少当前范围的审核修订、两校隔离或历史结果验证证据`);
  }
  return blockers;
}
