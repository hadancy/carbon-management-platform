import { Exact, parsePositive, parseRatio } from "./decimal";
import { convertUnit } from "./units";

export type AnnualEnergy = {
  operatingYear: number;
  periodStart: string;
  periodEnd: string;
  source: "ACTUAL" | "ESTIMATED";
  value: string;
  unit: string;
  evidence: string;
  method?: string;
};

export type EnergyProblem = { path: string; code: string; message: string };

function parsedDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const result = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(result.valueOf()) &&
    result.toISOString().slice(0, 10) === value
    ? result
    : null;
}

function annualPeriod(start: string, offset: number) {
  const first = parsedDate(start);
  if (!first || (first.getUTCMonth() === 1 && first.getUTCDate() === 29))
    return null;
  const begin = new Date(first);
  begin.setUTCFullYear(first.getUTCFullYear() + offset);
  const next = new Date(first);
  next.setUTCFullYear(first.getUTCFullYear() + offset + 1);
  next.setUTCDate(next.getUTCDate() - 1);
  return {
    periodStart: begin.toISOString().slice(0, 10),
    periodEnd: next.toISOString().slice(0, 10),
  };
}

export function sumAnnualEnergy(years: number, entries: AnnualEnergy[]) {
  const problems: EnergyProblem[] = [];
  if (!Number.isSafeInteger(years) || years < 1 || years > 100)
    problems.push({
      path: "operatingYears",
      code: "INVALID_YEARS",
      message: "运行年数须为 1～100 的整数",
    });
  const seen = new Set<number>();
  const periods = new Map<number, { start: Date; end: Date }>();
  let total = new Exact(0);
  for (const [index, entry] of entries.entries()) {
    const path = `annualEnergy.${index}`;
    if (
      !Number.isSafeInteger(entry.operatingYear) ||
      entry.operatingYear < 1 ||
      entry.operatingYear > years
    )
      problems.push({
        path: `${path}.operatingYear`,
        code: "INVALID_YEAR",
        message: "运行年份超出设计运行期",
      });
    if (seen.has(entry.operatingYear))
      problems.push({
        path: `${path}.operatingYear`,
        code: "DUPLICATE_YEAR",
        message: "运行年份重复",
      });
    seen.add(entry.operatingYear);
    const start = parsedDate(entry.periodStart);
    const end = parsedDate(entry.periodEnd);
    if (!start || !end || end < start)
      problems.push({
        path: `${path}.periodStart`,
        code: "INVALID_PERIOD",
        message: "年度电量须标明有效的起止日期",
      });
    else {
      periods.set(entry.operatingYear, { start, end });
      const expected = annualPeriod(entry.periodStart, 0);
      if (!expected || expected.periodEnd !== entry.periodEnd)
        problems.push({
          path: `${path}.periodEnd`,
          code: "PARTIAL_YEAR",
          message: "首版仅支持完整运行年度；不足一年的期间须待方法确认",
        });
    }
    const converted = convertUnit(entry.value, entry.unit, "kWh");
    if (!converted)
      problems.push({
        path: `${path}.value`,
        code: "INVALID_ENERGY",
        message: "年度电量须为非负十进制字符串，单位须可换算为 kWh",
      });
    else total = total.plus(converted.amount);
    if (
      !entry.evidence?.trim() ||
      (entry.source === "ESTIMATED" && !entry.method?.trim())
    )
      problems.push({
        path,
        code: "MISSING_EVIDENCE",
        message: "年度电量须填写凭证；估算年度还须填写方法",
      });
    if (entry.source !== "ACTUAL" && entry.source !== "ESTIMATED")
      problems.push({
        path: `${path}.source`,
        code: "INVALID_SOURCE",
        message: "年度电量来源无效",
      });
  }
  for (let year = 1; year <= years && year <= 100; year++)
    if (!seen.has(year))
      problems.push({
        path: `annualEnergy.${year}`,
        code: "MISSING_YEAR",
        message: `缺少第 ${year} 运行年的电量`,
      });
  for (let year = 2; year <= years && year <= 100; year++) {
    const previous = periods.get(year - 1);
    const current = periods.get(year);
    if (
      previous &&
      current &&
      current.start.valueOf() !== previous.end.valueOf() + 86400000
    )
      problems.push({
        path: `annualEnergy.${year}`,
        code: "PERIOD_GAP",
        message: `第 ${year - 1} 与 ${year} 运行年期间不连续`,
      });
  }
  return { total, problems };
}

export type EnergyEstimateInput = {
  operatingYears: number;
  firstPeriodStart: string;
  actual: AnnualEnergy[];
  capacityKw: string;
  fullLoadHours: string;
  performanceRatio: string;
  degradationRate: string;
  baseIncludesFirstYearDegradation: boolean;
  method: string;
  evidence: string;
};

// Optional planning helper. Its output is an explicit annual list; the core
// calculator never silently fills missing years.
export function estimateAnnualEnergy(input: EnergyEstimateInput) {
  const capacity = parsePositive(input.capacityKw);
  const hours = parsePositive(input.fullLoadHours);
  const performance = parseRatio(input.performanceRatio, false, true);
  const degradation = parseRatio(input.degradationRate, true, false);
  if (
    !capacity ||
    !hours ||
    !performance ||
    !degradation ||
    !Number.isSafeInteger(input.operatingYears) ||
    input.operatingYears < 1 ||
    input.operatingYears > 100 ||
    !annualPeriod(input.firstPeriodStart, 0) ||
    input.baseIncludesFirstYearDegradation ||
    !input.method.trim() ||
    !input.evidence.trim()
  )
    return {
      ok: false as const,
      problems: [
        {
          path: "estimate",
          code: "INVALID_ESTIMATE",
          message:
            "估算参数、方法或基准量冲突；已含首年衰减的基准量不能再次衰减",
        },
      ],
    };
  const seen = new Set<number>();
  for (const annual of input.actual) {
    if (seen.has(annual.operatingYear))
      return {
        ok: false as const,
        problems: [
          {
            path: "actual",
            code: "DUPLICATE_YEAR",
            message: "实测运行年份重复",
          },
        ],
      };
    seen.add(annual.operatingYear);
  }
  const entries: AnnualEnergy[] = [];
  const base = capacity.mul(hours).mul(performance);
  for (let year = 1; year <= input.operatingYears; year++) {
    const measured = input.actual.find((entry) => entry.operatingYear === year);
    const period = annualPeriod(input.firstPeriodStart, year - 1)!;
    entries.push(
      measured ?? {
        operatingYear: year,
        ...period,
        source: "ESTIMATED",
        value: base.mul(new Exact(1).minus(degradation).pow(year)).toString(),
        unit: "kWh",
        evidence: input.evidence,
        method: input.method,
      },
    );
  }
  const checked = sumAnnualEnergy(input.operatingYears, entries);
  return checked.problems.length
    ? { ok: false as const, problems: checked.problems }
    : { ok: true as const, entries, totalKwh: checked.total.toString() };
}
