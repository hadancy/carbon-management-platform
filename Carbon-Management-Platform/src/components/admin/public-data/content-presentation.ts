import { REPORT_CONTENT_FIELDS } from "@/shared/reports";
import { TEMPLATE_TEXT_FIELDS } from "@/shared/report-template";
import { canonicalUnitCode, factorUnitLabel, unitSymbol } from "@/shared/units";
import type { Entry } from "./types";

type DetailField = {
  key: string;
  label: string;
  value: string | null;
  fullWidth?: boolean;
  emptyText?: string;
};

type DetailSection = {
  key: string;
  title: string;
  fields: DetailField[];
};

export type ContentPresentation = {
  headline: string | null;
  purpose: string | null;
  note: string | null;
  sections: DetailSection[];
  notice: string | null;
  original: string;
};

const labels = {
  purpose: { TEST: "测试 / 演示", PRODUCTION: "正式业务" },
  product: { PV: "光伏发电" },
  scenario: { GRID_ONLY: "并网光伏" },
  formula: { PV_GRID_V1: "并网光伏五阶段核算（PV_GRID_V1）" },
  stage: {
    RS: "原材料与生产设备",
    TR: "运输",
    CS: "设施建设",
    US: "生产及退役",
    TD: "输配电",
  },
  applicability: { ALL: "全部适用" },
  sourceCategory: {
    SUPPLIER: "供应商",
    GOVERNMENT: "政府",
    INDUSTRY: "行业",
    DATABASE: "数据库",
    LITERATURE: "文献",
    STANDARD_APPENDIX: "标准资料附录",
    OTHER: "其他",
  },
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : null;
}

function label(
  value: unknown,
  dictionary: Record<string, string>,
): string | null {
  const valueText = text(value);
  return valueText
    ? Object.hasOwn(dictionary, valueText)
      ? dictionary[valueText]
      : valueText
    : null;
}

function field(
  key: string,
  title: string,
  value: unknown,
  fullWidth = false,
  emptyText?: string,
): DetailField {
  return { key, label: title, value: text(value), fullWidth, emptyText };
}

function factorSections(raw: Record<string, unknown>): DetailSection[] {
  const applicable = object(raw.applicability) ?? {};
  const evidence = object(raw.evidence) ?? {};
  const governance = object(raw.governance) ?? {};
  const activityUnit = text(raw.activityUnit);
  const emissionUnit = text(raw.emissionUnit);
  // Do not assume a legacy factor's numerator when its unit was not recorded.
  const completeUnit = !emissionUnit
    ? null
    : activityUnit
      ? emissionUnit === "kgCO2e"
        ? factorUnitLabel(canonicalUnitCode(activityUnit))
        : `${emissionUnit}/${unitSymbol(canonicalUnitCode(activityUnit))}`
      : null;
  return [
    {
      key: "factor",
      title: "因子信息",
      fields: [
        field("value", "因子数值", raw.value),
        field("unit", "完整因子单位", completeUnit),
        field("purpose", "用途", label(raw.purpose, labels.purpose)),
        field(
          "activityUnit",
          "活动数据单位",
          activityUnit && unitSymbol(canonicalUnitCode(activityUnit)),
        ),
        field("note", "因子说明", raw.note, true, "无"),
      ],
    },
    {
      key: "applicability",
      title: "适用范围",
      fields: [
        field("product", "适用产品", label(applicable.product, labels.product)),
        field("stage", "计算阶段", label(applicable.stage, labels.stage)),
        field(
          "subject",
          "适用对象",
          label(applicable.subject, labels.applicability),
        ),
        field(
          "region",
          "适用地域",
          label(applicable.region, labels.applicability),
        ),
        field(
          "technology",
          "适用技术",
          label(applicable.technology, labels.applicability),
        ),
        field(
          "dataYear",
          "数据所属年度",
          applicable.dataYear === 0 ? null : applicable.dataYear,
        ),
        field("validFrom", "适用开始日期", applicable.validFrom),
        field("validTo", "适用结束日期", applicable.validTo),
        field("boundary", "排放边界", applicable.boundary, true),
      ],
    },
    {
      key: "evidence",
      title: "来源与证据",
      fields: [
        field(
          "sourceCategory",
          "来源类别",
          label(evidence.sourceCategory, labels.sourceCategory),
        ),
        field("issuer", "发布机构", evidence.issuer),
        field("publishedAt", "资料发布日期", evidence.publishedAt),
        field("originalValue", "原始数值及单位", evidence.originalValue),
        field("reference", "资料定位", evidence.reference, true),
        field("conversion", "换算过程", evidence.conversion, true),
        field("license", "授权或使用依据", evidence.license, true),
      ],
    },
    {
      key: "governance",
      title: "版本依据",
      fields: [
        field("basis", "业务依据", governance.basis, true),
        field("changeReason", "版本变更原因", governance.changeReason, true),
        field(
          "supersedesVersionId",
          "替代版本标识",
          governance.supersedesVersionId,
          true,
          "无",
        ),
      ],
    },
  ];
}

function ruleSections(raw: Record<string, unknown>): DetailSection[] {
  return [
    {
      key: "rule",
      title: "计算规则",
      fields: [
        field("product", "适用产品", label(raw.product, labels.product)),
        field("scenario", "适用场景", label(raw.scenario, labels.scenario)),
        field("purpose", "用途", label(raw.purpose, labels.purpose)),
        field("formula", "计算方法", label(raw.formula, labels.formula)),
        field("effectiveFrom", "适用开始日期", raw.effectiveFrom),
        field("effectiveTo", "适用结束日期", raw.effectiveTo),
      ],
    },
    {
      key: "references",
      title: "标准与确认依据",
      fields: [
        field(
          "standardReference",
          "标准与公式引用",
          raw.standardReference,
          true,
        ),
        field(
          "approvalReference",
          "方法确认与授权依据",
          raw.approvalReference,
          true,
        ),
      ],
    },
  ];
}

function templateSections(raw: Record<string, unknown>): DetailSection[] {
  const defaults = object(raw.defaults) ?? {};
  return [
    {
      key: "template",
      title: "模板设置",
      fields: [
        field("product", "适用产品", label(raw.product, labels.product)),
        field("scenario", "适用场景", label(raw.scenario, labels.scenario)),
        field("purpose", "用途", label(raw.purpose, labels.purpose)),
        field("layoutVersion", "报告版式版本", raw.layoutVersion),
        field("titleSuffix", "标题后缀", raw.titleSuffix),
        field(
          "preparedBy",
          "默认编制机构",
          raw.preparedBy,
          false,
          "使用创建人",
        ),
        field("approvalReference", "模板确认依据", raw.approvalReference, true),
      ],
    },
    {
      key: "defaults",
      title: "默认报告内容",
      fields: TEMPLATE_TEXT_FIELDS.map((name) =>
        field(
          name,
          REPORT_CONTENT_FIELDS.find((definition) => definition.name === name)!
            .label,
          defaults[name],
          true,
          "使用内置内容",
        ),
      ),
    },
  ];
}

export function presentPublicDataContent(
  type: Entry["type"],
  content: string,
): ContentPresentation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = null;
  }
  const raw = object(parsed);
  if (!raw)
    return {
      headline: null,
      purpose: null,
      note: null,
      sections: [],
      notice: "该版本暂时无法转换为字段详情，可展开原始数据核对。",
      original: content,
    };
  const sections =
    type === "EMISSION_FACTOR"
      ? factorSections(raw)
      : type === "RULE_CONFIG"
        ? ruleSections(raw)
        : templateSections(raw);
  const value = text(raw.value);
  const unit = sections[0].fields.find((item) => item.key === "unit")?.value;
  return {
    headline:
      type === "EMISSION_FACTOR"
        ? value === null
          ? null
          : `${value} ${unit ?? "（完整单位待核对）"}`
        : type === "RULE_CONFIG"
          ? label(raw.formula, labels.formula)
          : text(raw.titleSuffix),
    purpose: label(raw.purpose, labels.purpose),
    note: text(raw.note),
    sections,
    notice: sections.some((section) =>
      section.fields.some((item) => item.value !== null),
    )
      ? null
      : "该版本尚无可展示的业务字段，可展开原始数据核对。",
    original: JSON.stringify(parsed, null, 2),
  };
}
