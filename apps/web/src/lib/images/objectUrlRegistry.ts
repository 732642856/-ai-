const managedObjectUrls = new Set<string>();

export function isBlobObjectUrl(url: unknown): url is string {
  return typeof url === "string" && url.startsWith("blob:");
}

export function createManagedObjectUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  managedObjectUrls.add(url);
  return url;
}

export function revokeManagedObjectUrl(url: string | null | undefined): void {
  if (!isBlobObjectUrl(url) || !managedObjectUrls.has(url)) return;

  URL.revokeObjectURL(url);
  managedObjectUrls.delete(url);
}

export function getManagedObjectUrlCount(): number {
  return managedObjectUrls.size;
}

export function revokeAllManagedObjectUrls(): void {
  for (const url of managedObjectUrls) {
    URL.revokeObjectURL(url);
  }
  managedObjectUrls.clear();
}
