const dateOptions = {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
} as const;

const minuteOptions = {
  ...dateOptions,
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
} as const;

const formatters = {
  date: new Intl.DateTimeFormat("zh-CN", dateOptions),
  minute: new Intl.DateTimeFormat("zh-CN", minuteOptions),
  second: new Intl.DateTimeFormat("zh-CN", {
    ...minuteOptions,
    second: "2-digit",
  }),
};

export function formatBeijingTime(
  value: string,
  precision: keyof typeof formatters = "second",
) {
  return formatters[precision].format(new Date(value));
}
