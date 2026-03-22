const DEFAULT_APP_TIME_ZONE = "America/New_York";
const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export const app_time_zone = process.env.APP_TIME_ZONE?.trim() || DEFAULT_APP_TIME_ZONE;

type TimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type DayKeyParts = {
  year: number;
  month: number;
  day: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function parse_integer(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parse_day_key_parts(value: string): DayKeyParts | null {
  const match = DAY_KEY_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { year, month, day };
}

function format_day_key(parts: DayKeyParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function get_time_parts_in_zone(date: Date, time_zone = app_time_zone): TimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: time_zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });

  const map = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return {
    year: parse_integer(map.year),
    month: parse_integer(map.month),
    day: parse_integer(map.day),
    hour: parse_integer(map.hour) % 24,
    minute: parse_integer(map.minute),
    second: parse_integer(map.second),
  };
}

function get_zone_offset_minutes(date: Date, time_zone = app_time_zone): number {
  const parts = get_time_parts_in_zone(date, time_zone);
  const local_as_utc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return Math.round((local_as_utc - date.getTime()) / 60_000);
}

function zoned_time_to_utc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  time_zone = app_time_zone,
): Date {
  const base_utc_ms = Date.UTC(year, month - 1, day, hour, minute, second);

  let utc_ms = base_utc_ms - get_zone_offset_minutes(new Date(base_utc_ms), time_zone) * 60_000;
  utc_ms = base_utc_ms - get_zone_offset_minutes(new Date(utc_ms), time_zone) * 60_000;

  return new Date(utc_ms);
}

function day_key_to_utc_midday(day_key: string): Date | null {
  const parsed = parse_day_key_parts(day_key);

  if (!parsed) {
    return null;
  }

  return zoned_time_to_utc(parsed.year, parsed.month, parsed.day, 12, 0, 0);
}

export function normalize_day_key_in_app_time_zone(value: string | null | undefined): string {
  if (!value) {
    return day_key_in_app_time_zone(new Date());
  }

  return parse_day_key_parts(value) ? value : day_key_in_app_time_zone(new Date());
}

export function day_key_in_app_time_zone(date: Date): string {
  const parts = get_time_parts_in_zone(date);
  return format_day_key(parts);
}

export function add_days_to_day_key(day_key: string, days: number): string {
  const parsed = parse_day_key_parts(day_key);

  if (!parsed || !Number.isFinite(days)) {
    return day_key;
  }

  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + Math.trunc(days));

  return format_day_key({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function day_start_from_key_in_app_time_zone(day_key: string): Date | null {
  const parsed = parse_day_key_parts(day_key);

  if (!parsed) {
    return null;
  }

  return zoned_time_to_utc(parsed.year, parsed.month, parsed.day, 0, 0, 0);
}

export function day_bounds_for_key_in_app_time_zone(day_key: string): {
  day_start: Date;
  day_end: Date;
} | null {
  const day_start = day_start_from_key_in_app_time_zone(day_key);

  if (!day_start) {
    return null;
  }

  const next_day_key = add_days_to_day_key(day_key, 1);
  const day_end = day_start_from_key_in_app_time_zone(next_day_key);

  if (!day_end) {
    return null;
  }

  return {
    day_start,
    day_end,
  };
}

export function day_bounds_for_date_in_app_time_zone(date: Date): {
  day_key: string;
  day_start: Date;
  day_end: Date;
} {
  const day_key = day_key_in_app_time_zone(date);
  const bounds = day_bounds_for_key_in_app_time_zone(day_key);

  if (!bounds) {
    const day_start = new Date(date);
    day_start.setHours(0, 0, 0, 0);
    const day_end = new Date(day_start);
    day_end.setDate(day_end.getDate() + 1);
    return {
      day_key,
      day_start,
      day_end,
    };
  }

  return {
    day_key,
    ...bounds,
  };
}

export function parse_datetime_local_in_app_time_zone(value: string): Date | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const local_match = DATETIME_LOCAL_PATTERN.exec(trimmed);

  if (local_match) {
    const year = Number(local_match[1]);
    const month = Number(local_match[2]);
    const day = Number(local_match[3]);
    const hour = Number(local_match[4]);
    const minute = Number(local_match[5]);
    const second = local_match[6] ? Number(local_match[6]) : 0;

    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      Number.isInteger(hour) &&
      Number.isInteger(minute) &&
      Number.isInteger(second)
    ) {
      return zoned_time_to_utc(year, month, day, hour, minute, second);
    }
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function format_datetime_local_in_app_time_zone(date: Date): string {
  const parts = get_time_parts_in_zone(date);

  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(
    parts.minute,
  )}`;
}

export function format_date_in_app_time_zone(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return date.toLocaleDateString("en-US", {
    ...options,
    timeZone: app_time_zone,
  });
}

export function format_day_key_in_app_time_zone(
  day_key: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const reference = day_key_to_utc_midday(day_key);

  if (!reference) {
    return day_key;
  }

  return format_date_in_app_time_zone(reference, options);
}

export function format_time_in_app_time_zone(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return date.toLocaleTimeString("en-US", {
    ...options,
    timeZone: app_time_zone,
  });
}
