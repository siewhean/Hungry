import type { MerchantOutlet } from "@/types/domain";

const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 600;
const MAX_OPERATING_HOURS_LENGTH = 120;
const MAX_TEMPORARY_CLOSURE_LENGTH = 160;
const MAX_CONTACT_PHONE_LENGTH = 30;
const MAX_CONTACT_EMAIL_LENGTH = 120;
const MAX_TAG_LENGTH = 32;
const MAX_TAG_COUNT = 12;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+\-()\s]{5,30}$/;

function normalizeText(value: string | undefined): string | undefined {
  if (typeof value !== "string") return value;
  return value.trim();
}

function normalizeStringArray(values: string[] | undefined): string[] | undefined {
  if (!values) return values;
  return values
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_TAG_COUNT);
}

export function validateMerchantProfileUpdates(
  updates: Partial<MerchantOutlet>,
): Partial<MerchantOutlet> {
  const normalized: Partial<MerchantOutlet> = { ...updates };

  normalized.name = normalizeText(normalized.name);
  normalized.description = normalizeText(normalized.description);
  normalized.operatingHours = normalizeText(normalized.operatingHours);
  normalized.temporaryClosure = normalizeText(normalized.temporaryClosure);
  normalized.contactPhone = normalizeText(normalized.contactPhone);
  normalized.contactEmail = normalizeText(normalized.contactEmail);
  normalized.unitNumber = normalizeText(normalized.unitNumber);
  normalized.floor = normalizeText(normalized.floor);
  normalized.cuisineCategories = normalizeStringArray(normalized.cuisineCategories);
  normalized.tasteTags = normalizeStringArray(normalized.tasteTags);

  if (normalized.name !== undefined && normalized.name.length === 0) {
    throw new Error("Business name cannot be empty.");
  }
  if (normalized.name && normalized.name.length > MAX_NAME_LENGTH) {
    throw new Error(`Business name must be at most ${MAX_NAME_LENGTH} characters.`);
  }

  if (normalized.description && normalized.description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`);
  }

  if (normalized.operatingHours && normalized.operatingHours.length > MAX_OPERATING_HOURS_LENGTH) {
    throw new Error(`Operating hours must be at most ${MAX_OPERATING_HOURS_LENGTH} characters.`);
  }

  if (
    normalized.temporaryClosure &&
    normalized.temporaryClosure.length > MAX_TEMPORARY_CLOSURE_LENGTH
  ) {
    throw new Error(
      `Temporary closure notice must be at most ${MAX_TEMPORARY_CLOSURE_LENGTH} characters.`,
    );
  }

  if (normalized.contactEmail && normalized.contactEmail.length > MAX_CONTACT_EMAIL_LENGTH) {
    throw new Error(`Contact email must be at most ${MAX_CONTACT_EMAIL_LENGTH} characters.`);
  }
  if (normalized.contactEmail && !EMAIL_REGEX.test(normalized.contactEmail)) {
    throw new Error("Contact email format is invalid.");
  }

  if (normalized.contactPhone && normalized.contactPhone.length > MAX_CONTACT_PHONE_LENGTH) {
    throw new Error(`Contact phone must be at most ${MAX_CONTACT_PHONE_LENGTH} characters.`);
  }
  if (normalized.contactPhone && !PHONE_REGEX.test(normalized.contactPhone)) {
    throw new Error("Contact phone format is invalid.");
  }

  if (normalized.locationPrivacy === "exact" && normalized.businessType === "home_based") {
    throw new Error("Home-based businesses cannot use exact location privacy.");
  }

  if (normalized.cuisineCategories?.some((tag) => tag.length > MAX_TAG_LENGTH)) {
    throw new Error(`Cuisine categories must each be at most ${MAX_TAG_LENGTH} characters.`);
  }
  if (normalized.tasteTags?.some((tag) => tag.length > MAX_TAG_LENGTH)) {
    throw new Error(`Taste tags must each be at most ${MAX_TAG_LENGTH} characters.`);
  }

  return normalized;
}
