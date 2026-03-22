import { describe, expect, it } from "vitest";
import {
  day_bounds_for_key_in_app_time_zone,
  day_key_in_app_time_zone,
  format_datetime_local_in_app_time_zone,
  parse_datetime_local_in_app_time_zone,
} from "./app-time";

describe("app-time", () => {
  it("computes day keys in the configured app timezone", () => {
    const date = new Date("2026-03-22T02:30:00.000Z");
    expect(day_key_in_app_time_zone(date)).toBe("2026-03-21");
  });

  it("builds correct day bounds for a local day key", () => {
    const bounds = day_bounds_for_key_in_app_time_zone("2026-03-21");

    expect(bounds).not.toBeNull();
    expect(bounds?.day_start.toISOString()).toBe("2026-03-21T04:00:00.000Z");
    expect(bounds?.day_end.toISOString()).toBe("2026-03-22T04:00:00.000Z");
  });

  it("parses datetime-local values in app timezone", () => {
    const parsed = parse_datetime_local_in_app_time_zone("2026-03-21T22:30");
    expect(parsed?.toISOString()).toBe("2026-03-22T02:30:00.000Z");
  });

  it("formats utc instants back to app local datetime-local value", () => {
    const formatted = format_datetime_local_in_app_time_zone(
      new Date("2026-03-22T02:30:00.000Z"),
    );
    expect(formatted).toBe("2026-03-21T22:30");
  });
});
