import type { MerchantOutlet } from "@/types/domain";
import { isInSingapore, SINGAPORE_POSTAL_CODE_PATTERN } from "@/lib/geo/oneMap";
import { validateOpeningSchedule } from "@/utils/openingSchedule";

const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 600;
// Derived from the weekly schedule: up to 7 day groups of 3 ranges each.
const MAX_OPERATING_HOURS_LENGTH = 300;
const MAX_ADDRESS_LENGTH = 200;
const MAX_TEMPORARY_CLOSURE_LENGTH = 160;
const MAX_CONTACT_PHONE_LENGTH = 30;
const MAX_CONTACT_EMAIL_LENGTH = 120;
const MAX_TAG_LENGTH = 32;
const MAX_TAG_COUNT = 12;
const MAX_SOCIAL_LINKS = 5;
const MAX_URL_LENGTH = 300;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+\-()\s]{5,30}$/;

function normalizeText(value: string | undefined): string | undefined {
  if (typeof value !== "string") return value;
  return value.trim();
}

function normalizeSocialLinks(
  links: MerchantOutlet["socialLinks"] | undefined,
): MerchantOutlet["socialLinks"] | undefined {
  if (!links) return links;
  return links
    .map((link) => ({ platform: link.platform.trim().toLowerCase(), url: link.url.trim() }))
    .filter((link) => link.platform && link.url)
    .map((link) => ({
      ...link,
      url: /^https?:\/\//i.test(link.url) ? link.url : `https://${link.url}`,
    }));
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
  normalized.address = normalizeText(normalized.address);
  normalized.postalCode = normalizeText(normalized.postalCode);
  normalized.cuisineCategories = normalizeStringArray(normalized.cuisineCategories);
  normalized.tasteTags = normalizeStringArray(normalized.tasteTags);
  normalized.socialLinks = normalizeSocialLinks(normalized.socialLinks);

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

  if (normalized.openingSchedule) {
    const problem = validateOpeningSchedule(normalized.openingSchedule);
    if (problem) throw new Error(problem);
  }

  if (normalized.postalCode && !SINGAPORE_POSTAL_CODE_PATTERN.test(normalized.postalCode)) {
    throw new Error("Postal code must be 6 digits.");
  }
  if (normalized.address && normalized.address.length > MAX_ADDRESS_LENGTH) {
    throw new Error(`Address must be at most ${MAX_ADDRESS_LENGTH} characters.`);
  }
  if (normalized.coordinate && !isInSingapore(normalized.coordinate)) {
    throw new Error("The map pin must be in Singapore.");
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

  if (normalized.socialLinks && normalized.socialLinks.length > MAX_SOCIAL_LINKS) {
    throw new Error(`Add at most ${MAX_SOCIAL_LINKS} links.`);
  }
  normalized.socialLinks?.forEach((link) => {
    if (link.url.length > MAX_URL_LENGTH || !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(link.url)) {
      throw new Error(`The ${link.platform} link is not a valid web address.`);
    }
  });

  return normalized;
}
