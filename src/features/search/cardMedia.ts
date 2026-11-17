/** Keep source indexes when failed/blank gallery images are omitted. */
export function availableCardImages(images: readonly string[], failedUrls: readonly string[]) {
  return images.flatMap((url, originalIndex) =>
    url.trim() && !failedUrls.includes(url) ? [{ url, originalIndex }] : [],
  );
}
