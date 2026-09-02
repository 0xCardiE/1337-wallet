/** Unpacked builds only — store packages have an `update_url`. */
export function isUnpackedExtension(): boolean {
  try {
    return !chrome.runtime.getManifest().update_url;
  } catch {
    return false;
  }
}
