const HR_TOLERANCE = 0.1;
const BR_TOLERANCE = 0.1;

export interface TBPayload {
  deviceId: string;
  observationId?: string;
  tbState: string | null;
  tbHr: number | null;
  tbBr: number | null;
  effectiveTsMs?: number;
  rawData?: unknown;
  topic?: string;
}

export interface MonitorSnapshot {
  deviceId: string;
  snapshot: {
    sleepizStatus: string;
    analytics: {
      heartRateAvg: number | null;
      heartRate: { valid: boolean };
      breathingRateAvg: number | null;
      breathingRate: { valid: boolean };
    };
  };
}

export interface CompareResult {
  result: "OK" | "State Mismatch" | "HR Mismatch" | "BR Mismatch";
  tbState: string | null;
  monitorState: string | null;
  tbHr: number | null;
  monitorHr: number | null;
  tbBr: number | null;
  monitorBr: number | null;
}

function normalizeState(s: string | null | undefined): string | null {
  if (s == null || s === "") return null;
  const v = String(s).toLowerCase().trim();
  if (v === "awake" || v === "asleep" || v === "absent" || v === "away")
    return v === "away" ? "absent" : v;
  return v;
}

function valuesEqual(
  a: number | null,
  b: number | null,
  tolerance: number,
): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= tolerance;
}

export function compare(
  tb: TBPayload,
  monitor: MonitorSnapshot | null,
): CompareResult {
  const tbState = normalizeState(tb.tbState);
  const monitorState = monitor
    ? normalizeState(monitor.snapshot.sleepizStatus)
    : null;

  // -1 is backend sentinel for "no reading"; treat as null
  const rawHr = monitor?.snapshot?.analytics?.heartRateAvg;
  const rawBr = monitor?.snapshot?.analytics?.breathingRateAvg;
  const monitorHr =
    monitor?.snapshot?.analytics?.heartRate?.valid &&
    rawHr != null &&
    rawHr >= 0
      ? rawHr
      : null;
  const monitorBr =
    monitor?.snapshot?.analytics?.breathingRate?.valid &&
    rawBr != null &&
    rawBr >= 0
      ? rawBr
      : null;

  const tbHr =
    tb.tbHr != null && !Number.isNaN(Number(tb.tbHr)) ? Number(tb.tbHr) : null;
  const tbBr =
    tb.tbBr != null && !Number.isNaN(Number(tb.tbBr)) ? Number(tb.tbBr) : null;

  const stateMatch = tbState === monitorState;
  const hrMatch = valuesEqual(tbHr, monitorHr, HR_TOLERANCE);
  const brMatch = valuesEqual(tbBr, monitorBr, BR_TOLERANCE);

  let result: CompareResult["result"] = "OK";
  if (!stateMatch) result = "State Mismatch";
  else if (!hrMatch) result = "HR Mismatch";
  else if (!brMatch) result = "BR Mismatch";

  return {
    result,
    tbState: tbState ?? tb.tbState,
    monitorState: monitorState ?? monitor?.snapshot?.sleepizStatus ?? null,
    tbHr,
    monitorHr,
    tbBr,
    monitorBr,
  };
}
