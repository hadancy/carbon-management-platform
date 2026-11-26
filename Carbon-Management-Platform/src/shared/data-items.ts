import { z } from "zod";
import { factorUnitLabel, isKnownUnit, isNumericFactor } from "./units";

const optionalText = (max: number) => z.string().trim().max(max).default("");

export const dataItemFieldsSchema = z
  .object({
    dataName: z.string().trim().min(1, "请填写数据名称").max(200),
    specModel: optionalText(200),
    manufacturer: optionalText(200),
    carbonFootprintFactor: optionalText(120),
    functionalUnit: optionalText(120).refine(
      (value) => !value || isKnownUnit(value),
      "请选择列表中的活动数据单位",
    ),
    emissionFactor: optionalText(120).refine(
      (value) => !value || isNumericFactor(value),
      "排放因子仅填写有限数值，单位由活动数据单位生成",
    ),
    factorSource: optionalText(300),
    dataSource: optionalText(300),
  })
  .strict();

export const publishedDataItemFieldsSchema = dataItemFieldsSchema.extend({
  functionalUnit: z
    .string()
    .trim()
    .refine(isKnownUnit, "发布前请选择活动数据单位"),
});

export const createDataItemSchema = dataItemFieldsSchema.extend({
  code: z
    .string()
    .trim()
    .min(2, "编码至少填写 2 个字符")
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/, "编码仅支持字母、数字、下划线和连字符")
    .transform((value) => value.toUpperCase()),
});

export const updateDataItemSchema = dataItemFieldsSchema.extend({
  revision: z.number().int().positive(),
});

export const publishDataItemSchema = publishedDataItemFieldsSchema.extend({
  revision: z.number().int().positive(),
});

export const retireDataItemSchema = z
  .object({
    revision: z.number().int().positive(),
    reason: z.string().trim().min(1, "请填写停用原因").max(1000),
  })
  .strict();

export const deleteDataItemSchema = z
  .object({ revision: z.number().int().positive() })
  .strict();

export const dataItemListQuerySchema = z.object({
  q: z.string().trim().max(200).default(""),
  status: z.enum(["ALL", "DRAFT", "PUBLISHED", "RETIRED"]).default("ALL"),
  unit: z
    .string()
    .refine((value) => !value || isKnownUnit(value))
    .default(""),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const dataItemCatalogQuerySchema = dataItemListQuerySchema
  .omit({ status: true })
  .strict();
export type DataItemCatalogQuery = z.infer<typeof dataItemCatalogQuerySchema>;

export const dataItemHistoryQuerySchema = dataItemListQuerySchema
  .pick({ page: true, pageSize: true })
  .extend({ dataItemId: z.uuid() })
  .strict();
export type DataItemHistoryQuery = z.infer<typeof dataItemHistoryQuerySchema>;

export const dataItemFieldNames = Object.keys(
  dataItemFieldsSchema.shape,
) as (keyof DataItemFields)[];

export function dataItemFields(value: DataItemFields): DataItemFields {
  return Object.fromEntries(
    dataItemFieldNames.map((key) => [key, value[key]]),
  ) as DataItemFields;
}

export function sameDataItemFields(a: DataItemFields, b: DataItemFields) {
  return dataItemFieldNames.every((key) => a[key] === b[key]);
}

export function formatDataItemEmissionFactor({
  emissionFactor,
  functionalUnit,
}: Pick<DataItemFields, "emissionFactor" | "functionalUnit">) {
  if (!emissionFactor) return "—";
  return functionalUnit
    ? `${emissionFactor} ${factorUnitLabel(functionalUnit)}`
    : `${emissionFactor}（单位待填写）`;
}

export type DataItemFields = z.infer<typeof dataItemFieldsSchema>;
export type DataItemListQuery = z.infer<typeof dataItemListQuerySchema>;
export type DataItemEntry = DataItemFields & {
  id: string;
  dataItemId: string;
  code: string;
  version: number;
  revision: number;
  status: "DRAFT" | "PUBLISHED";
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  retiredAt: string | null;
  retirementReason: string | null;
};

export type DataItemList = {
  entries: DataItemEntry[];
  total: number;
  query: DataItemListQuery;
};

export type AdminDataItemEntry = DataItemEntry & { referenceCount: number };
export type AdminDataItemList = Omit<DataItemList, "entries"> & {
  entries: AdminDataItemEntry[];
};

export type AdminDataItemGroup = {
  id: string;
  code: string;
  current: AdminDataItemEntry | null;
  draft: AdminDataItemEntry | null;
  latestRetired: AdminDataItemEntry | null;
  historyCount: number;
};

export type AdminDataItemGroups = {
  groups: AdminDataItemGroup[];
  total: number;
  query: DataItemListQuery;
};

export type AdminDataItemHistory = {
  entries: AdminDataItemEntry[];
  total: number;
  page: number;
  pageSize: number;
};

export type ModelDataItemChange = {
  scope: "PUBLIC" | "SCHOOL";
  createdDraft: boolean;
  updated: number;
  needsReview: number;
  awaitingReview: boolean;
};

export const dataItemStatusOptions = [
  { value: "ALL", label: "全部状态" },
  { value: "DRAFT", label: "含草稿" },
  { value: "PUBLISHED", label: "有发布版" },
  { value: "RETIRED", label: "含历史版本" },
];
