import type { OpeningSchedule, VenueSummary } from "@/types/domain";
import {
  formatHoursRows,
  getHoursForDay,
  getSingaporeDay,
  getVenueOpenState,
  parseOperatingHours,
  type OpenState,
} from "@/utils/operatingHours";
import {
  formatScheduleRows,
  formatScheduleToday,
  getScheduleOpenState,
  getUpcomingSpecialHours,
  hasWeeklyHours,
} from "@/utils/openingSchedule";

export type StallHoursRow = { label: string; text: string };

export interface StallOpenInfo {
  openState: OpenState;
  isOpen: boolean;
  /** One line for the page: "Open now · Closes 9pm", "Closed now · Opens 10am", or the owner's closure text. */
  statusLabel: string;
  /** The owner's temporary-closure text, else the stored closure notice. */
  closureNotice?: string;
  /**
   * The closure notice when the status line does not already say it, so a page shows the
   * notice once: under the header only when the hours card says something else.
   */
  extraNotice?: string;
  /** The whole week (plus upcoming special hours); unreadable text is still shown as written. */
  weekRows: StallHoursRow[];
  /** Just today, for a collapsed hours card; the whole week when today cannot be told. */
  todayRows: StallHoursRow[];
}

/**
 * The one place a stall's open state is decided, so the stall page and the dish page
 * agree. Order: the owner's temporary closure, then the weekly schedule with special
 * hours, then the listed hours text.
 */
export function resolveStallOpenInfo(input: {
  venue: Pick<VenueSummary, "isOpen" | "operatingHours" | "openingSchedule" | "closureNotice">;
  /** A schedule read separately from the venue; wins over `venue.openingSchedule`. */
  schedule?: OpeningSchedule;
  temporaryClosure?: string;
  now?: Date;
}): StallOpenInfo {
  const { venue, temporaryClosure, now } = input;
  const schedule = input.schedule ?? venue.openingSchedule;
  const listedHours = venue.operatingHours?.trim() ?? "";
  const textRows = parseOperatingHours(venue.operatingHours);

  const computed: OpenState = hasWeeklyHours(schedule)
    ? getScheduleOpenState(schedule, venue.isOpen, now)
    : getVenueOpenState(venue.operatingHours, venue.isOpen, now);
  const closure = temporaryClosure?.trim() || undefined;
  const openState: OpenState = closure ? { status: "closed" } : computed;
  const closureNotice = closure ?? venue.closureNotice;

  const statusLabel = closure
    ? closure
    : openState.status === "open"
      ? ["Open now", openState.detail].filter(Boolean).join(" · ")
      : openState.status === "unknown"
        ? listedHours
          ? "Check listed hours"
          : "Hours not listed"
        : (closureNotice ?? ["Closed now", openState.detail].filter(Boolean).join(" · "));

  const parsedRows: StallHoursRow[] = hasWeeklyHours(schedule)
    ? [
        ...formatScheduleRows(schedule),
        ...getUpcomingSpecialHours(schedule, now).map((row) => ({
          label: `${row.label} (special)`,
          text: row.text,
        })),
      ]
    : formatHoursRows(textRows);
  const weekRows: StallHoursRow[] =
    parsedRows.length > 0 ? parsedRows : listedHours ? [{ label: "Hours", text: listedHours }] : [];

  let todayRows = weekRows;
  if (hasWeeklyHours(schedule)) {
    todayRows = [{ label: "Today", text: formatScheduleToday(schedule, now) }];
  } else if (textRows.length > 0) {
    const todayRow = getHoursForDay(textRows, getSingaporeDay(now));
    // No row for today (a weekday-only listing on a Sunday) means closed today.
    todayRows = [
      { label: "Today", text: todayRow && !todayRow.closed ? todayRow.text : "Closed today" },
    ];
  }

  return {
    openState,
    isOpen: openState.status === "open",
    statusLabel,
    closureNotice,
    extraNotice: closureNotice && closureNotice !== statusLabel ? closureNotice : undefined,
    weekRows,
    todayRows,
  };
}
