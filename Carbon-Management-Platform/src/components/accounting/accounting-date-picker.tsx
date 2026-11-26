"use client";

import { DatePicker, type DatePickerProps } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import "dayjs/locale/zh-cn";
import { z } from "zod";

dayjs.extend(customParseFormat);

const dateFormat = "YYYY-MM-DD";
const dateFormats = [dateFormat, "YYYY-M-DD", "YYYY-MM-D", "YYYY-M-D"];
const isoDate = z.iso.date();

export function isAccountingDate(value: unknown): value is string {
  return isoDate.safeParse(value).success;
}

function parsePickerDate(value?: string) {
  if (!value) return null;
  const date = isAccountingDate(value)
    ? dayjs(new Date(`${value}T00:00:00`))
    : dayjs(value, dateFormats, true);
  return date.isValid() ? date : null;
}

export function normalizeAccountingDate(value?: string) {
  return parsePickerDate(value)?.format(dateFormat) ?? value ?? "";
}

export const requiredAccountingDateRule = {
  required: true,
  async validator(_: unknown, value: unknown) {
    if (!isAccountingDate(value)) throw new Error("请选择有效日期");
  },
};

type AccountingDatePickerProps = Omit<
  DatePickerProps<Dayjs, false>,
  "value" | "defaultValue" | "onChange" | "format" | "multiple" | "picker"
> & {
  value?: string;
  onChange?: (value: string) => void;
};

export function AccountingDatePicker({
  value,
  onChange,
  ...props
}: AccountingDatePickerProps) {
  return (
    <DatePicker
      className="w-full"
      {...props}
      format={dateFormats}
      value={parsePickerDate(value)}
      onChange={(date) => onChange?.(date?.format(dateFormat) ?? "")}
    />
  );
}
