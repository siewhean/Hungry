/** The parts of the long business-profile form that other screens and errors can scroll to. */
export type EditorSection = "basic" | "location" | "hours" | "contact";

const SECTION_ORDER: readonly EditorSection[] = ["basic", "location", "hours", "contact"];

const FIELD_SECTIONS: Readonly<Record<string, EditorSection>> = {
  name: "basic",
  description: "basic",
  unitNumber: "location",
  floor: "location",
  postalCode: "location",
  address: "location",
  openingSchedule: "hours",
  temporaryClosure: "hours",
  contactPhone: "contact",
  contactEmail: "contact",
};

/** The topmost section holding one of the invalid fields, so the form scrolls to the first error. */
export function firstInvalidSection(fieldNames: readonly string[]): EditorSection | undefined {
  const found = new Set(
    fieldNames.map((field) => FIELD_SECTIONS[field]).filter((s): s is EditorSection => Boolean(s)),
  );
  return SECTION_ORDER.find((section) => found.has(section));
}
