/**
 * The gallery after a profile save: the new profile and cover photos first, then the earlier
 * gallery photos. A photo that was replaced is dropped, so changing the cover does not leave the
 * old one in the gallery for good.
 */
export function nextGalleryUrls(
  previous: {
    profilePhotoUrl?: string;
    coverPhotoUrl?: string;
    galleryUrls: readonly string[];
  },
  next: { profilePhotoUrl: string; coverPhotoUrl: string },
): string[] {
  const replaced = new Set<string>();
  if (next.profilePhotoUrl !== (previous.profilePhotoUrl ?? "") && previous.profilePhotoUrl) {
    replaced.add(previous.profilePhotoUrl);
  }
  if (next.coverPhotoUrl !== (previous.coverPhotoUrl ?? "") && previous.coverPhotoUrl) {
    replaced.add(previous.coverPhotoUrl);
  }
  return Array.from(
    new Set(
      [
        next.profilePhotoUrl,
        next.coverPhotoUrl,
        ...previous.galleryUrls.filter((url) => !replaced.has(url)),
      ].filter(Boolean),
    ),
  );
}
