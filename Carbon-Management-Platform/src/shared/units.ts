export const unitOptions: {
  label: string;
  options: { value: string; label: string }[];
}[] = [
  {
    label: "质量",
    options: [
      { value: "g", label: "克 (g)" },
      { value: "kg", label: "千克 (kg)" },
      { value: "t", label: "吨 (t)" },
    ],
  },
  {
    label: "能源与电量",
    options: [
      { value: "kWh", label: "千瓦时 (kWh)" },
      { value: "Wh", label: "瓦时 (Wh)" },
      { value: "MWh", label: "兆瓦时 (MWh)" },
      { value: "kW", label: "千瓦 (kW)" },
      { value: "MJ", label: "兆焦 (MJ)" },
      { value: "GJ", label: "吉焦 (GJ)" },
    ],
  },
  {
    label: "体积与长度",
    options: [
      { value: "L", label: "升 (L)" },
      { value: "m3", label: "立方米 (m³)" },
      { value: "m", label: "米 (m)" },
      { value: "km", label: "千米 (km)" },
      { value: "m2", label: "平方米 (m²)" },
    ],
  },
  {
    label: "运输与数量",
    options: [
      { value: "t_km", label: "吨公里 (t·km)" },
      { value: "台", label: "台" },
      { value: "块", label: "块" },
      { value: "套", label: "套" },
      { value: "辆", label: "辆" },
      { value: "件", label: "件" },
      { value: "个", label: "个" },
    ],
  },
];

const unitSymbols: Record<string, string> = {
  m3: "m³",
  m2: "m²",
  t_km: "t·km",
};

const knownUnits = new Set<string>(
  unitOptions.flatMap((group) => group.options.map((option) => option.value)),
);

export const unitConversionDefinitions: Record<
  string,
  { dimension: string; toBase: string }
> = {
  g: { dimension: "mass", toBase: "0.001" },
  kg: { dimension: "mass", toBase: "1" },
  t: { dimension: "mass", toBase: "1000" },
  Wh: { dimension: "energy", toBase: "0.001" },
  kWh: { dimension: "energy", toBase: "1" },
  MWh: { dimension: "energy", toBase: "1000" },
  m: { dimension: "distance", toBase: "0.001" },
  km: { dimension: "distance", toBase: "1" },
  L: { dimension: "volume", toBase: "0.001" },
  m3: { dimension: "volume", toBase: "1" },
};

export function canConvertUnit(source: string, target: string) {
  if (!isKnownUnit(source) || !isKnownUnit(target)) return false;
  return (
    source === target ||
    (!!unitConversionDefinitions[source] &&
      unitConversionDefinitions[source].dimension ===
        unitConversionDefinitions[target]?.dimension)
  );
}

export function compatibleUnitOptions(target: string) {
  return unitOptions
    .flatMap((group) => group.options)
    .filter((option) => canConvertUnit(option.value, target));
}

export function isKnownUnit(value: string): boolean {
  return knownUnits.has(value);
}

export function canonicalUnitCode(value: string): string {
  const legacyAliases: Record<string, string> = {
    "m²": "m2",
    "m³": "m3",
    "t·km": "t_km",
  };
  return legacyAliases[value] ?? value;
}

export function unitSymbol(value: string): string {
  return unitSymbols[value] ?? value;
}

export function factorUnitLabel(activityUnit: string): string {
  const denominator = unitSymbol(activityUnit);
  return `kgCO₂e/${activityUnit === "t_km" ? `(${denominator})` : denominator}`;
}

export function isNumericFactor(value: string): boolean {
  const text = value.trim();
  return (
    /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) &&
    Number.isFinite(Number(text))
  );
}
