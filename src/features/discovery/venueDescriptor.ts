export function getDirectoryDescriptor(options: {
  operatingHours?: string;
  isFacility: boolean;
}): string {
  if (options.operatingHours) {
    return options.operatingHours;
  }

  return options.isFacility ? "Facility / seating" : "Independent unit";
}
