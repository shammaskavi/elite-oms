export type BlousePathKey =
  | "shoulder" | "chest" | "waist" | "length"
  | "sleeve" | "armhole" | "fneck" | "bneck" | "none";

export interface MeasurementStep {
  id: string;
  label: string;
  desc: string;
  path: BlousePathKey;
  iconNumber: string;
}