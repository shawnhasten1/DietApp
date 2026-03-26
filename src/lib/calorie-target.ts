import { app_time_zone } from "@/lib/app-time";

export const weekday_keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type WeekdayKey = (typeof weekday_keys)[number];

export type CalorieScheduleProfile = {
  target_calories: number;
  target_calories_sun: number | null;
  target_calories_mon: number | null;
  target_calories_tue: number | null;
  target_calories_wed: number | null;
  target_calories_thu: number | null;
  target_calories_fri: number | null;
  target_calories_sat: number | null;
};

function weekday_key_for_date(date: Date): WeekdayKey {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: app_time_zone,
  })
    .format(date)
    .toLowerCase();

  switch (weekday) {
    case "sun":
      return "sun";
    case "mon":
      return "mon";
    case "tue":
      return "tue";
    case "wed":
      return "wed";
    case "thu":
      return "thu";
    case "fri":
      return "fri";
    default:
      return "sat";
  }
}

function schedule_override_for_weekday(
  profile: CalorieScheduleProfile,
  weekday: WeekdayKey,
): number | null {
  switch (weekday) {
    case "sun":
      return profile.target_calories_sun;
    case "mon":
      return profile.target_calories_mon;
    case "tue":
      return profile.target_calories_tue;
    case "wed":
      return profile.target_calories_wed;
    case "thu":
      return profile.target_calories_thu;
    case "fri":
      return profile.target_calories_fri;
    case "sat":
      return profile.target_calories_sat;
    default:
      return null;
  }
}

export function resolve_target_calories_for_date(profile: CalorieScheduleProfile, date: Date): {
  target_calories: number;
  weekday: WeekdayKey;
  uses_schedule_override: boolean;
} {
  const weekday = weekday_key_for_date(date);
  const override = schedule_override_for_weekday(profile, weekday);

  return {
    target_calories: override ?? profile.target_calories,
    weekday,
    uses_schedule_override: override !== null,
  };
}

