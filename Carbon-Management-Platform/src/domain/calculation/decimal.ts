import { Decimal } from "@prisma/client-runtime-utils";

// A private constructor keeps the calculation precision independent of Prisma's
// own Decimal configuration and of any UI formatting.
export const Exact = Decimal.clone({
  precision: 50,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -100,
  toExpPos: 100,
});

export type ExactValue = InstanceType<typeof Exact>;

const INPUT = /^(?:0|[1-9]\d{0,17})(?:\.\d{1,18})?$/;

export function parseNonnegative(value: unknown): ExactValue | null {
  if (typeof value !== "string" || !INPUT.test(value)) return null;
  const decimal = new Exact(value);
  return decimal.isFinite() ? decimal : null;
}

export function parsePositive(value: unknown): ExactValue | null {
  const decimal = parseNonnegative(value);
  return decimal?.gt(0) ? decimal : null;
}

export function parseRatio(
  value: unknown,
  inclusiveZero: boolean,
  inclusiveOne: boolean,
): ExactValue | null {
  const decimal = parseNonnegative(value);
  if (!decimal) return null;
  if (inclusiveZero ? decimal.lt(0) : decimal.lte(0)) return null;
  if (inclusiveOne ? decimal.gt(1) : decimal.gte(1)) return null;
  return decimal;
}

export function percentToRatio(value: unknown): string | null {
  const percent = parseNonnegative(value);
  return percent && percent.lte(100) ? percent.div(100).toString() : null;
}

export function decimalText(value: ExactValue): string {
  return value.toString();
}

export function displayDecimal(
  value: ExactValue,
  places: number,
): {
  value: string;
  belowDisplayPrecision: boolean;
} {
  const rounded = value.toFixed(places, Exact.ROUND_HALF_UP);
  return {
    value: rounded,
    belowDisplayPrecision: value.gt(0) && new Exact(rounded).eq(0),
  };
}
