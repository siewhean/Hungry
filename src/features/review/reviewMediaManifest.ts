export interface ReviewMediaManifestEntry {
  bucket: "review-media-v2";
  path: string;
  sortOrder: number;
}
export async function buildReviewMediaManifest(input: {
  folder: string;
  photos: string[];
  assertActive: () => void;
  listExisting: () => Promise<{ path: string }[]>;
  upload: (path: string, uri: string) => Promise<{ path: string }>;
}): Promise<ReviewMediaManifestEntry[]> {
  let existing = input.photos.length ? await input.listExisting() : [];
  const uploaded: ReviewMediaManifestEntry[] = [];
  for (let index = 0; index < input.photos.length; index++) {
    input.assertActive();
    const uri = input.photos[index];
    const findPrevious = () =>
      existing.find(
        (file) =>
          file.path.startsWith(`${input.folder}/photo-${index}.`) &&
          !file.path.slice(input.folder.length + 1).includes("/"),
      );
    let previous = findPrevious();
    if (previous) {
      uploaded.push({ bucket: "review-media-v2", path: previous.path, sortOrder: index });
      continue;
    }
    const extension =
      uri.match(/\.(jpg|jpeg|png|webp|heic)(?:[?#]|$)/i)?.[1].toLowerCase() ?? "jpg";
    try {
      const asset = await input.upload(`${input.folder}/photo-${index}.${extension}`, uri);
      uploaded.push({ bucket: "review-media-v2", path: asset.path, sortOrder: index });
    } catch (error) {
      input.assertActive();
      existing = await input.listExisting();
      input.assertActive();
      previous = findPrevious();
      if (previous)
        uploaded.push({ bucket: "review-media-v2", path: previous.path, sortOrder: index });
      else
        throw new Error(
          `Photo ${index + 1} of ${input.photos.length} could not be confirmed. Uploaded photos are preserved for retry. ${error instanceof Error ? error.message : ""}`,
        );
    }
  }
  input.assertActive();
  return uploaded;
}
