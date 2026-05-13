import { getDataRepository } from "@/lib/services/serviceProvider";
import type { Coordinate } from "@/types/domain";

export type ComposerLocationOption = {
  id: string;
  name: string;
  address: string;
  coordinate: Coordinate;
};

export type ComposerCollaboratorOption = {
  id: string;
  name: string;
  handle: string;
  avatar: string;
};

function toHandle(name: string) {
  return `@${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "")}`;
}

export function listComposerLocationOptions(): ComposerLocationOption[] {
  const repository = getDataRepository();
  return repository.listBuildings().map((building) => ({
    id: building.id,
    name: building.name,
    address: `${building.name}, Singapore`,
    coordinate: building.coordinate,
  }));
}

export function listComposerCollaboratorOptions(): ComposerCollaboratorOption[] {
  const repository = getDataRepository();
  const byHandle = new Map<string, ComposerCollaboratorOption>();

  repository.listStallPosts().forEach((post) => {
    const handle = toHandle(post.authorName);
    if (byHandle.has(handle)) return;
    byHandle.set(handle, {
      id: `collab-${handle.slice(1)}`,
      name: post.authorName,
      handle,
      avatar: post.authorAvatarUrl,
    });
  });

  return Array.from(byHandle.values());
}
