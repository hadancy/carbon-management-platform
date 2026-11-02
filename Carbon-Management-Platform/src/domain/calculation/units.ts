import {
  isKnownUnit,
  unitConversionDefinitions as conversion,
} from "@/shared/units";
import { Exact, parseNonnegative, type ExactValue } from "./decimal";

export type UnitConversion = {
  originalValue: string;
  originalUnit: string;
  targetUnit: string;
  multiplier: string;
  convertedValue: string;
};

export function convertUnit(
  value: unknown,
  source: string,
  target: string,
): { amount: ExactValue; trace: UnitConversion } | null {
  const amount = parseNonnegative(value);
  if (!amount || !isKnownUnit(source) || !isKnownUnit(target)) return null;
  let multiplier: ExactValue;
  if (source === target) multiplier = new Exact(1);
  else {
    const from = conversion[source];
    const to = conversion[target];
    if (!from || !to || from.dimension !== to.dimension) return null;
    multiplier = new Exact(from.toBase).div(to.toBase);
  }
  const converted = amount.mul(multiplier);
  return {
    amount: converted,
    trace: {
      originalValue: value as string,
      originalUnit: source,
      targetUnit: target,
      multiplier: multiplier.toString(),
      convertedValue: converted.toString(),
    },
  };
}
