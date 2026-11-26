import {
  accountingInputsSchema,
  type AccountingInputs,
} from "@/shared/accounting";
import { sumAnnualEnergy } from "@/domain/calculation/energy";
export type EnergyRow = AccountingInputs["annualEnergy"][number];
export const ENERGY_CSV_HEADER = [
  "运行年",
  "起始日期",
  "结束日期",
  "来源",
  "电量",
  "单位",
  "凭证说明",
  "估算方法",
];
export function yearPeriod(first: string, offset: number) {
  const start = new Date(`${first}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(first) ||
    !Number.isFinite(start.valueOf()) ||
    start.toISOString().slice(0, 10) !== first
  )
    throw Error("请输入有效的起始日期");
  if (start.getUTCMonth() === 1 && start.getUTCDate() === 29)
    throw Error("运行年度暂不支持以 2 月 29 日为起始日期");
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + offset + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  start.setUTCFullYear(start.getUTCFullYear() + offset);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}
export function generateEnergyRows(
  years: number,
  first: string,
  base: Omit<EnergyRow, "operatingYear" | "periodStart" | "periodEnd">,
  existing: EnergyRow[],
) {
  if (!Number.isInteger(years) || years < 1 || years > 100)
    throw Error("运行年数须为 1～100");
  const rows = Array.from(
    { length: years },
    (_, index) =>
      existing.find((item) => item.operatingYear === index + 1) ?? {
        ...base,
        operatingYear: index + 1,
        ...yearPeriod(first, index),
      },
  );
  const checked = sumAnnualEnergy(years, rows);
  if (checked.problems.length) throw Error(checked.problems[0].message);
  return rows;
}
export function energyCsv(rows: EnergyRow[]) {
  const quote = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  return (
    "\uFEFF" +
    [
      ENERGY_CSV_HEADER,
      ...rows.map((row) => [
        row.operatingYear,
        row.periodStart,
        row.periodEnd,
        row.source === "ACTUAL" ? "实测" : "估算",
        row.value,
        row.unit,
        row.evidence,
        row.method ?? "",
      ]),
    ]
      .map((row) => row.map(quote).join(","))
      .join("\r\n")
  );
}
function csvCells(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      if (cell || closed) throw Error("CSV 引号位置无效");
      quoted = true;
    } else if (ch === "," || ch === "\n" || ch === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (ch !== ",") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        if (row.some((value) => value.trim())) rows.push(row);
        row = [];
      }
    } else {
      if (closed) throw Error("CSV 引号后只能使用分隔符");
      cell += ch;
    }
  }
  if (quoted) throw Error("CSV 引号未闭合");
  if (cell || closed || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
}
export function parseEnergyCsv(
  text: string,
  years: number,
  existing: EnergyRow[],
) {
  if (text.length > 500000) throw Error("CSV 不能超过 500 KB");
  const [header, ...cells] = csvCells(text);
  if (
    !header ||
    header.length !== 8 ||
    header.some((value, index) => value.trim() !== ENERGY_CSV_HEADER[index])
  )
    throw Error("请使用下载模板中的八列及其顺序");
  if (!cells.length || cells.length > 100)
    throw Error("CSV 须包含 1～100 个年度");
  const seen = new Set<number>();
  const rows = cells.map((cell, index) => {
    if (cell.length !== 8) throw Error(`第 ${index + 2} 行列数不正确`);
    const [year, start, end, source, value, unit, evidence, method] = cell.map(
      (value) => value.trim(),
    );
    const operatingYear = Number(year);
    if (
      !/^\d+$/.test(year) ||
      operatingYear < 1 ||
      operatingYear > years ||
      seen.has(operatingYear)
    )
      throw Error(`第 ${index + 2} 行运行年重复或超出运行期`);
    seen.add(operatingYear);
    const result = accountingInputsSchema.shape.annualEnergy
      .unwrap()
      .element.safeParse({
        operatingYear,
        periodStart: start,
        periodEnd: end,
        source:
          source === "实测" || source === "ACTUAL"
            ? "ACTUAL"
            : source === "估算" || source === "ESTIMATED"
              ? "ESTIMATED"
              : source,
        value,
        unit,
        evidence,
        method,
        evidenceAssetIds:
          existing.find((row) => row.operatingYear === operatingYear)
            ?.evidenceAssetIds ?? [],
      });
    if (!result.success)
      throw Error(
        `第 ${index + 2} 行格式无效：${result.error.issues[0].message}`,
      );
    return result.data;
  });
  const merged = [
    ...existing.filter((row) => !seen.has(row.operatingYear)),
    ...rows,
  ].sort((a, b) => a.operatingYear - b.operatingYear);
  const problems = sumAnnualEnergy(years, merged).problems.filter(
    (problem) => problem.code !== "MISSING_YEAR",
  );
  if (problems.length) throw Error(problems[0].message);
  return {
    rows: merged,
    imported: rows.length,
    replaced: existing.filter((row) => seen.has(row.operatingYear)).length,
  };
}
