import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  View,
  StyleSheet,
  TouchableOpacity,
  type LayoutChangeEvent,
  type ScrollView,
} from "react-native";
import { Camera, Image as ImageIcon } from "lucide-react-native";
import { useForm, Controller, type FieldErrors } from "react-hook-form";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { MerchantImageField } from "@/components/merchant/MerchantImageField";
import { OpeningHoursEditor } from "@/components/merchant/OpeningHoursEditor";
import { MapSurface } from "@/components/map";
import {
  AccessibleImage,
  AppText,
  Button,
  ChipGroup,
  EmptyState,
  FormSwitchRow,
  Input,
  Screen,
  SelectField,
} from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { Coordinate, MerchantOutlet, LocationPrivacy, OpeningSchedule } from "@/types/domain";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { isVerificationCurrent } from "@/features/merchant/merchantGuards";
import { MAX_CUISINES, getCuisineChoices, toggleCuisine } from "@/features/merchant/cuisineOptions";
import { formatBusinessType } from "@/features/merchant/merchantReadiness";
import { nextGalleryUrls } from "@/features/merchant/galleryUrls";
import { firstInvalidSection, type EditorSection } from "@/features/merchant/profileEditorSections";
import { trackMerchantEvent } from "@/features/merchant/merchantTracking";
import { useMerchantDialog } from "@/features/merchant/useMerchantDialog";
import { useUnsavedChangesGuard } from "@/features/merchant/useUnsavedChangesGuard";
import { lookupPostalCode, SINGAPORE_POSTAL_CODE_PATTERN } from "@/lib/geo/oneMap";
import { isBlockedTextError } from "@/features/merchant/featuredDishes";
import { reportError } from "@/lib/monitoring/reportError";
import {
  formatScheduleText,
  scheduleFromHoursText,
  validateOpeningSchedule,
} from "@/utils/openingSchedule";

type NavigationProp = NativeStackNavigationProp<MerchantTabParamList, "BusinessProfileEditor">;

type FormData = {
  name: string;
  description: string;
  businessType: MerchantOutlet["businessType"];
  cuisineCategories: string[];
  unitNumber: string;
  floor: string;
  postalCode: string;
  address: string;
  coordinate: Coordinate | null;
  locationPrivacy: LocationPrivacy;
  openingSchedule: OpeningSchedule;
  temporaryClosure: string;
  profilePhotoUrl: string;
  coverPhotoUrl: string;
  contactPhone: string;
  contactEmail: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  isLive: boolean;
};

const LINK_FIELDS = [
  { field: "websiteUrl", platform: "website", label: "Website", placeholder: "e.g. laksa.sg" },
  {
    field: "instagramUrl",
    platform: "instagram",
    label: "Instagram",
    placeholder: "e.g. instagram.com/yourstall",
  },
  {
    field: "facebookUrl",
    platform: "facebook",
    label: "Facebook",
    placeholder: "e.g. facebook.com/yourstall",
  },
] as const;

function toFormData(outlet: MerchantOutlet): FormData {
  return {
    name: outlet.name || "",
    description: outlet.description || "",
    businessType: outlet.businessType || "hawker_stall",
    cuisineCategories: outlet.cuisineCategories ?? [],
    unitNumber: outlet.unitNumber || "",
    floor: outlet.floor || "",
    postalCode: outlet.postalCode || "",
    address: outlet.address || "",
    coordinate: outlet.coordinate ?? null,
    locationPrivacy: toHomeBasedPrivacy(outlet.locationPrivacy),
    // Older outlets only have free-text hours: seed the weekly editor from them.
    openingSchedule: outlet.openingSchedule ?? scheduleFromHoursText(outlet.operatingHours),
    temporaryClosure: outlet.temporaryClosure || "",
    profilePhotoUrl: outlet.profilePhotoUrl || "",
    coverPhotoUrl: outlet.coverPhotoUrl || "",
    contactPhone: outlet.contactPhone || "",
    contactEmail: outlet.contactEmail || "",
    websiteUrl: findLink(outlet.socialLinks, "website"),
    instagramUrl: findLink(outlet.socialLinks, "instagram"),
    facebookUrl: findLink(outlet.socialLinks, "facebook"),
    isLive: outlet.isLive,
  };
}

function findLink(links: MerchantOutlet["socialLinks"] | undefined, platform: string): string {
  return links?.find((link) => link.platform.toLowerCase() === platform)?.url ?? "";
}

const HOME_BASED_PRIVACY_OPTIONS: { id: Exclude<LocationPrivacy, "exact">; label: string }[] = [
  { id: "approximate", label: "Approximate area" },
  { id: "hidden", label: "Hidden" },
];

function toHomeBasedPrivacy(value: LocationPrivacy | undefined): Exclude<LocationPrivacy, "exact"> {
  return value === "hidden" ? "hidden" : "approximate";
}

const BUSINESS_TYPE_OPTIONS: MerchantOutlet["businessType"][] = [
  "hawker_stall",
  "food_court_stall",
  "restaurant",
  "cafe",
  "mall_tenant",
  "home_based",
];
const BUSINESS_TYPE_SELECT_OPTIONS = BUSINESS_TYPE_OPTIONS.map((value) => ({
  label: formatBusinessType(value),
  value,
}));

function BusinessTypeDropdown({
  value,
  onChange,
  locked,
}: {
  value: MerchantOutlet["businessType"];
  onChange: (value: MerchantOutlet["businessType"]) => void;
  locked: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <SelectField
        label="Business type"
        value={value}
        options={BUSINESS_TYPE_SELECT_OPTIONS}
        onChange={onChange}
        disabled={locked}
      />
      {locked ? (
        <AppText variant="bodySmall" tone="muted">
          The business type is fixed once your stall is verified, because it decides whether the
          unit can be hidden. Contact Hungry to change it.
        </AppText>
      ) : null}
    </View>
  );
}

export function BusinessProfileEditorScreen() {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();
  const openSection =
    useRoute<RouteProp<MerchantTabParamList, "BusinessProfileEditor">>().params?.section;
  const rootNavigation = getRootNavigation(navigation as any);
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const { showAlert, dialog } = useMerchantDialog();
  const isOutletVerified = isVerificationCurrent(activeOutlet?.verification);
  const updateOutletProfile = useMerchantStore((state) => state.updateOutletProfile);
  const setAccount = useMerchantStore((state) => state.setAccount);
  // The account restored from storage has no contact details (they are never persisted). Until
  // a fresh copy arrives the form would seed blank phone/email fields, so wait for one first.
  const [isRefreshingAccount, setIsRefreshingAccount] = useState(() => {
    const { accountSyncedAt, developerMerchantMode } = useMerchantStore.getState();
    return accountSyncedAt === null && !developerMerchantMode;
  });
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [hoursError, setHoursError] = useState<string>();
  const [postalStatus, setPostalStatus] = useState<string>();
  const [isLookingUpPostal, setIsLookingUpPostal] = useState(false);
  // Section tops, measured as the form lays out, so a tap on Location, Hours or Contact on the
  // Profile tab and a failed Save can both scroll the long form to the right place.
  const scrollRef = useRef<ScrollView>(null);
  const formTop = useRef(0);
  const sectionTop = useRef<Partial<Record<EditorSection, number>>>({});
  const openedSection = useRef(false);
  const scrollToSection = useCallback((section: EditorSection) => {
    const top = sectionTop.current[section];
    if (top === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, formTop.current + top - 12), animated: true });
  }, []);
  const trackSection = (section: EditorSection, offset = 0) => ({
    onLayout: (event: LayoutChangeEvent) => {
      sectionTop.current[section] = offset + event.nativeEvent.layout.y;
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    formState: { isSubmitting, isDirty, dirtyFields, errors },
  } = useForm<FormData>({
    defaultValues: {
      name: "",
      description: "",
      businessType: "hawker_stall",
      cuisineCategories: [],
      unitNumber: "",
      floor: "",
      postalCode: "",
      address: "",
      coordinate: null,
      locationPrivacy: "approximate",
      openingSchedule: { weekly: {}, special: [] },
      temporaryClosure: "",
      profilePhotoUrl: "",
      coverPhotoUrl: "",
      contactPhone: "",
      contactEmail: "",
      websiteUrl: "",
      instagramUrl: "",
      facebookUrl: "",
      isLive: false,
    },
  });

  const businessType = watch("businessType");
  const coordinate = watch("coordinate");

  // OneMap postal-code lookup fills the street address and drops the map pin.
  const handlePostalLookup = async () => {
    const postalCode = getValues("postalCode").trim();
    if (!SINGAPORE_POSTAL_CODE_PATTERN.test(postalCode)) {
      setPostalStatus("Enter a 6-digit postal code.");
      return;
    }
    setIsLookingUpPostal(true);
    setPostalStatus(undefined);
    try {
      const result = await lookupPostalCode(postalCode);
      if (!result) {
        setPostalStatus("No address found for this postal code.");
        return;
      }
      setValue("address", result.address, { shouldDirty: true });
      setValue("coordinate", result.coordinate, { shouldDirty: true });
      setPostalStatus("Address found. Tap the map to fine-tune the pin.");
    } catch (error) {
      reportError(error, { screen: "BusinessProfileEditor", action: "postal_lookup" });
      setPostalStatus(error instanceof Error ? error.message : "Postal code lookup failed.");
    } finally {
      setIsLookingUpPostal(false);
    }
  };

  // Seed once per outlet. A background account sync hands back a new outlet object with the
  // same id: re-seed only while the form is untouched, so it never wipes the merchant's edits.
  const seededOutletId = useRef<string | null>(null);
  useEffect(() => {
    if (!activeOutlet || isRefreshingAccount) return;
    if (seededOutletId.current === activeOutlet.id && isDirty) return;
    seededOutletId.current = activeOutlet.id;
    reset(toFormData(activeOutlet));
  }, [activeOutlet, isDirty, isRefreshingAccount, reset]);

  useEffect(() => {
    if (!isRefreshingAccount) return;
    let isMounted = true;
    getHungryService()
      .merchant.getMerchantAccount()
      .then((account) => {
        if (isMounted && account) setAccount(account);
      })
      .catch((error) => {
        // Editing still works: contact fields are only sent when the merchant changes them.
        reportError(error, { screen: "BusinessProfileEditor", action: "refresh_account" });
      })
      .finally(() => {
        if (isMounted) setIsRefreshingAccount(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isRefreshingAccount, setAccount]);

  const leaveEditor = useCallback(() => navigation.goBack(), [navigation]);
  const confirmLeave = useUnsavedChangesGuard(isDirty && !isSubmitting, leaveEditor, showAlert);

  const onSubmit = async (data: FormData) => {
    if (!activeOutlet) return;
    const hoursProblem = validateOpeningSchedule(data.openingSchedule);
    setHoursError(hoursProblem);
    if (hoursProblem) {
      showAlert("Check opening hours", hoursProblem);
      scrollToSection("hours");
      return;
    }
    try {
      const profilePhotoUrl = data.profilePhotoUrl.trim();
      const coverPhotoUrl = data.coverPhotoUrl.trim();
      setIsUploadingImages(
        [profilePhotoUrl, coverPhotoUrl].some(
          (value) =>
            value.startsWith("file://") || value.startsWith("content://") || value.startsWith("/"),
        ),
      );
      const galleryUrls = nextGalleryUrls(activeOutlet, { profilePhotoUrl, coverPhotoUrl });
      const updates: Partial<MerchantOutlet> = {
        name: data.name,
        description: data.description,
        businessType: data.businessType,
        cuisineCategories: data.cuisineCategories,
        unitNumber: data.unitNumber,
        floor: data.floor,
        postalCode: data.postalCode,
        address: data.address,
        ...(data.coordinate ? { coordinate: data.coordinate } : {}),
        // Location privacy only applies to home-based businesses (never exact for them).
        ...(data.businessType === "home_based"
          ? { locationPrivacy: toHomeBasedPrivacy(data.locationPrivacy) }
          : {}),
        openingSchedule: data.openingSchedule,
        // The readable line older screens and the catalog show; "Open now" uses the schedule.
        operatingHours: formatScheduleText(data.openingSchedule),
        temporaryClosure: data.temporaryClosure,
        profilePhotoUrl,
        coverPhotoUrl,
        galleryUrls,
        // Only fields the merchant touched: a form seeded without contact details (stale cache,
        // failed refresh) must never write blanks over the stored phone and email.
        ...(dirtyFields.contactPhone ? { contactPhone: data.contactPhone } : {}),
        ...(dirtyFields.contactEmail ? { contactEmail: data.contactEmail } : {}),
        socialLinks: [
          ...activeOutlet.socialLinks.filter(
            (link) => !LINK_FIELDS.some(({ platform }) => platform === link.platform.toLowerCase()),
          ),
          ...LINK_FIELDS.map(({ field, platform }) => ({
            platform,
            url: data[field].trim(),
          })).filter((link) => link.url),
        ],
        isLive: data.isLive,
      };

      const updated = await getHungryService().merchant.updateBusinessProfile(
        activeOutlet.id,
        updates,
      );
      // Saved: the next outlet object re-seeds the form, clearing the unsaved-changes guard.
      reset(data);
      updateOutletProfile(activeOutlet.id, updated);
      trackMerchantEvent("merchant_profile_updated", activeOutlet.id, { is_live: data.isLive });
      showAlert(
        "Saved",
        !data.isLive
          ? 'Your profile is saved. Turn on "Show on Hungry" when you want diners to see it.'
          : isOutletVerified
            ? "Your changes are live for diners now."
            : "Your profile is saved. Diners will see it once Hungry verifies your stall.",
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      // A refused blocked word is the merchant's text, shown back to them, not a failure to report.
      if (!isBlockedTextError(error)) {
        reportError(error, { screen: "BusinessProfileEditor", action: "save_profile" });
      }
      showAlert(
        "Couldn't save profile",
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
    } finally {
      setIsUploadingImages(false);
    }
  };

  const onInvalid = (invalid: FieldErrors<FormData>) => {
    const section = firstInvalidSection(Object.keys(invalid));
    if (section) scrollToSection(section);
  };

  const handlePreviewAsCustomer = () => {
    // The outlet's own venue only; guessing from a dish or the building can open another stall.
    const venueId = activeOutlet?.venueId;
    if (venueId) rootNavigation.navigate("StallDetail", { venueId });
  };

  if (isRefreshingAccount) {
    return (
      <Screen title="Business profile">
        <View style={{ paddingVertical: spacing[6], alignItems: "center", gap: spacing[3] }}>
          <ActivityIndicator color={palette.orange} accessibilityLabel="Loading" />
          <AppText variant="body" tone="muted">
            Loading your business profile...
          </AppText>
        </View>
      </Screen>
    );
  }

  if (!activeOutlet) {
    return (
      <Screen title="Business profile">
        <EmptyState
          title="No active outlet selected"
          body="A business profile cannot be loaded until you choose a merchant outlet."
          errorMessage="No active outlet was found for this merchant session."
          sendErrorContext="Business profile editor"
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Business profile"
      onBackPress={confirmLeave}
      scrollRef={scrollRef}
      contentContainerStyle={{ paddingBottom: spacing[6] }}
      footer={
        <Button
          label={isSubmitting ? "Saving..." : "Save profile"}
          variant="primary"
          fullWidth
          onPress={handleSubmit(onSubmit, onInvalid)}
          disabled={isSubmitting}
        />
      }
      headerRight={
        <TouchableOpacity
          onPress={handlePreviewAsCustomer}
          disabled={!activeOutlet.venueId}
          accessibilityRole="button"
          accessibilityLabel="Preview as customer"
          accessibilityHint={
            activeOutlet.venueId ? undefined : "Available once your stall is linked to a listing"
          }
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            styles.previewButton,
            {
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: spacing[3],
              borderRadius: radii.pill,
              opacity: activeOutlet.venueId ? 1 : 0.5,
            },
            { backgroundColor: palette.bgSoft, borderColor: palette.border },
          ]}
        >
          <AppText variant="bodySmallBold" tone="muted">
            Preview
          </AppText>
        </TouchableOpacity>
      }
    >
      <View
        style={{ gap: spacing[6], width: "100%" }}
        onLayout={(event) => {
          formTop.current = event.nativeEvent.layout.y;
          if (openSection && !openedSection.current) {
            openedSection.current = true;
            scrollToSection(openSection);
          }
        }}
      >
        {isOutletVerified && (
          <View
            style={[
              styles.verifiedBadge,
              {
                paddingVertical: spacing[2],
                paddingHorizontal: spacing[3],
                borderRadius: componentRadii.card,
              },
              { backgroundColor: palette.successSoft, borderColor: palette.success },
            ]}
          >
            <AppText variant="bodySmallBold" style={{ color: palette.success }}>
              ✓ Verified by Hungry
            </AppText>
          </View>
        )}

        <View style={{ gap: spacing[4] }} {...trackSection("basic")}>
          <AppText variant="h3" style={{ fontWeight: "600" }}>
            Basic info
          </AppText>

          <View>
            <Controller
              control={control}
              name="name"
              rules={{ required: "Name is required" }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Business name *"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="e.g. Uncle Tan's Chicken Rice"
                  error={Boolean(errors.name)}
                  errorText={errors.name?.message}
                />
              )}
            />
          </View>

          <View>
            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Description"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  multiline
                  numberOfLines={4}
                  placeholder="Tell customers about your business..."
                  style={{ minHeight: 100, textAlignVertical: "top" }}
                />
              )}
            />
          </View>

          <View>
            <Controller
              control={control}
              name="businessType"
              render={({ field: { onChange, value } }) => (
                <BusinessTypeDropdown value={value} onChange={onChange} locked={isOutletVerified} />
              )}
            />
          </View>
        </View>

        <View style={{ gap: spacing[4] }}>
          <AppText variant="h3" style={{ fontWeight: "600" }}>
            Photos
          </AppText>

          <View style={{ gap: spacing[4] }}>
            <Controller
              control={control}
              name="profilePhotoUrl"
              render={({ field: { onChange, value } }) => (
                <MerchantImageField
                  label="Profile image"
                  rationale="Hungry needs access to your photo library to upload your stall's profile image."
                  value={value}
                  onChange={onChange}
                  isSaving={isUploadingImages}
                  icon={<Camera size={24} color={palette.textMuted} />}
                />
              )}
            />

            <Controller
              control={control}
              name="coverPhotoUrl"
              render={({ field: { onChange, value } }) => (
                <MerchantImageField
                  label="Cover image"
                  rationale="Hungry needs access to your photo library to upload your stall's cover image."
                  value={value}
                  onChange={onChange}
                  isSaving={isUploadingImages}
                  icon={<ImageIcon size={24} color={palette.textMuted} />}
                />
              )}
            />
          </View>
        </View>

        <View style={{ gap: spacing[4] }}>
          <AppText variant="h3" style={{ fontWeight: "600" }}>
            Cuisine
          </AppText>

          <View>
            <Controller
              control={control}
              name="cuisineCategories"
              render={({ field: { onChange, value } }) => (
                <View style={{ gap: spacing[2] }}>
                  <ChipGroup
                    options={getCuisineChoices(value).map((id) => ({ id, label: id }))}
                    selectedIds={value}
                    onSelect={(id) => onChange(toggleCuisine(value, id))}
                  />
                  <AppText variant="bodySmall" tone="muted" accessibilityLiveRegion="polite">
                    {value.length >= MAX_CUISINES
                      ? `${value.length} of ${MAX_CUISINES} picked. Tap one to swap it.`
                      : `Pick up to ${MAX_CUISINES} so diners can find you by cuisine.`}
                  </AppText>
                </View>
              )}
            />
          </View>
        </View>

        <View style={{ gap: spacing[4] }} {...trackSection("location")}>
          <AppText variant="h3" style={{ fontWeight: "600" }}>
            Location and hours
          </AppText>

          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="unitNumber"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Unit number"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    placeholder="#01-12"
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="floor"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Floor"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    placeholder="Level 1"
                  />
                )}
              />
            </View>
          </View>

          <View style={{ gap: spacing[2] }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing[3] }}>
              <View style={{ flex: 1 }}>
                <Controller
                  control={control}
                  name="postalCode"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Postal code"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="e.g. 069184"
                    />
                  )}
                />
              </View>
              <Button
                label={isLookingUpPostal ? "Finding..." : "Find address"}
                variant="secondary"
                onPress={() => void handlePostalLookup()}
                disabled={isLookingUpPostal}
                loading={isLookingUpPostal}
              />
            </View>
            {postalStatus ? (
              <AppText variant="bodySmall" tone="muted" accessibilityLiveRegion="polite">
                {postalStatus}
              </AppText>
            ) : null}
            <Controller
              control={control}
              name="address"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Street address"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="Filled in from the postal code"
                />
              )}
            />
            {coordinate ? (
              <View style={{ gap: spacing[1] }}>
                <MapSurface
                  style={{ height: 180, borderRadius: componentRadii.card, overflow: "hidden" }}
                  centerCoordinate={coordinate}
                  zoomLevel={17}
                  markers={[{ id: "outlet-pin", label: "Your stall", coordinate }]}
                  selectedMarkerId="outlet-pin"
                  onMapPress={(next) => setValue("coordinate", next, { shouldDirty: true })}
                />
                <AppText variant="bodySmall" tone="muted">
                  {businessType === "home_based"
                    ? "Home-based businesses never show this pin to diners."
                    : "Tap the map to move the pin to your stall's entrance."}
                </AppText>
              </View>
            ) : null}
          </View>

          <View
            onLayout={(event) => {
              sectionTop.current.hours =
                (sectionTop.current.location ?? 0) + event.nativeEvent.layout.y;
            }}
          >
            <Controller
              control={control}
              name="openingSchedule"
              render={({ field: { onChange, value } }) => (
                <OpeningHoursEditor
                  value={value}
                  onChange={(next) => {
                    setHoursError(undefined);
                    onChange(next);
                  }}
                  error={hoursError}
                />
              )}
            />
          </View>

          <View>
            <Controller
              control={control}
              name="temporaryClosure"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Temporary closure notice"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder="e.g. Closed for CNY until 15 Feb"
                />
              )}
            />
          </View>

          {businessType === "home_based" ? (
            <View style={{ gap: spacing[2] }}>
              <AppText variant="bodySmallBold">Location shown to diners</AppText>
              <Controller
                control={control}
                name="locationPrivacy"
                render={({ field: { onChange, value } }) => (
                  <ChipGroup
                    options={HOME_BASED_PRIVACY_OPTIONS}
                    selectedId={toHomeBasedPrivacy(value)}
                    onSelect={onChange}
                  />
                )}
              />
              <AppText variant="bodySmall" tone="muted">
                Home-based businesses never show a unit number, floor or exact pin. Hidden also
                removes the street address.
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={{ gap: spacing[4] }} {...trackSection("contact")}>
          <AppText variant="h3" style={{ fontWeight: "600" }}>
            Contact info
          </AppText>

          <View>
            <Controller
              control={control}
              name="contactPhone"
              rules={{
                pattern: {
                  value: /^(\+65\s?)?[3689]\d{3}\s?\d{4}$/,
                  message: "Enter an 8-digit Singapore number, e.g. 6123 4567 or 9123 4567",
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Phone number"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  keyboardType="phone-pad"
                  placeholder="e.g. 8123 4567"
                  error={Boolean(errors.contactPhone)}
                  errorText={errors.contactPhone?.message}
                />
              )}
            />
          </View>

          <View>
            <Controller
              control={control}
              name="contactEmail"
              rules={{
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Please enter a valid email address",
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Email address"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="e.g. hello@business.com"
                  error={Boolean(errors.contactEmail)}
                  errorText={errors.contactEmail?.message}
                />
              )}
            />
          </View>
        </View>

        <View style={{ gap: spacing[4] }}>
          <AppText variant="h3" style={{ fontWeight: "600" }}>
            Links
          </AppText>
          {LINK_FIELDS.map(({ field, label, placeholder }) => (
            <Controller
              key={field}
              control={control}
              name={field}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={label}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={placeholder}
                />
              )}
            />
          ))}
        </View>

        <View style={{ gap: spacing[4] }}>
          <AppText variant="h3" style={{ fontWeight: "600" }}>
            Visibility
          </AppText>
          <Controller
            control={control}
            name="isLive"
            render={({ field: { onChange, value } }) => (
              <FormSwitchRow
                label="Show on Hungry"
                description="Diners see your description, contact details, links and promotions on your stall page."
                value={value}
                onValueChange={onChange}
              />
            )}
          />
        </View>
      </View>
      {dialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  previewButton: {
    borderWidth: 1,
  },
  verifiedBadge: {
    borderWidth: 1,
    alignSelf: "flex-start",
  },
});
