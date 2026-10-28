/** The meals a person can say they usually eat out, and the start times offered for each. */
export const MEAL_KEYS = ["breakfast", "lunch", "dinner", "supper"] as const;
export type MealKey = (typeof MEAL_KEYS)[number];

export const MEAL_LABELS: Record<MealKey, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  supper: "Supper",
};

/** 24-hour "HH:MM" start times shown as chips. */
export const MEAL_TIME_OPTIONS: Record<MealKey, readonly string[]> = {
  breakfast: ["07:00", "07:30", "08:00", "09:00"],
  lunch: ["11:30", "12:00", "12:30", "13:00"],
  dinner: ["18:00", "18:30", "19:00", "20:00"],
  supper: ["21:30", "22:30", "23:30", "00:30"],
};

/** The time that is picked when a meal chip is tapped on. */
export const DEFAULT_MEAL_TIME: Record<MealKey, string> = {
  breakfast: "08:00",
  lunch: "12:00",
  dinner: "18:30",
  supper: "22:30",
};

/** How long before the usual time the meal-picks push arrives. */
export const PUSH_LEAD_MINUTES = 45;

/** Meals that get a push in this release; breakfast and supper are saved for later. */
export const PUSHED_MEALS: readonly MealKey[] = ["lunch", "dinner"];

export type MealTimes = Partial<Record<MealKey, string>>;

/** "12:00" -> "12:00 pm", "18:30" -> "6:30 pm", "00:30" -> "12:30 am". */
export function formatMealTime(time: string): string {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "pm" : "am";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${minuteText} ${suffix}`;
}

/** The time of the push for a usual meal time: "12:00" -> "11:15". Wraps past midnight. */
export function pushTimeFor(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const total = (((hour! * 60 + minute! - PUSH_LEAD_MINUTES) % 1440) + 1440) % 1440;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** The meal whose push the notification preview shows: lunch first, then dinner, then none. */
export function previewMeal(times: MealTimes): { meal: MealKey; time: string } | null {
  for (const meal of PUSHED_MEALS) {
    const time = times[meal];
    if (time) return { meal, time };
  }
  return null;
}

/** Picks a meal on or off. Turning it on gives it its default time. */
export function toggleMeal(times: MealTimes, meal: MealKey): MealTimes {
  if (times[meal]) {
    const { [meal]: _removed, ...rest } = times;
    return rest;
  }
  return { ...times, [meal]: DEFAULT_MEAL_TIME[meal] };
}

export function setMealTime(times: MealTimes, meal: MealKey, time: string): MealTimes {
  if (!MEAL_TIME_OPTIONS[meal].includes(time)) return times;
  return { ...times, [meal]: time };
}
