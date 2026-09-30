/**
 * Durable key/value settings persistence.
 *
 * window.localStorage does not reliably survive an app restart for this app's
 * file:// renderer origin in Electron/Chromium, so anything that must persist
 * across launches (theme, default project settings, saved tolerance presets)
 * goes through the main process's file-backed store (ipc-settings-get/set)
 * instead. localStorage is kept only as a same-session cache for instant
 * first-paint reads, and as a fallback when window.api isn't available.
 */

export async function getPersistentSetting(key: string): Promise<string | null> {
  if (typeof window !== 'undefined' && window.api?.getStoredSetting) {
    try {
      const { value } = await window.api.getStoredSetting(key);
      if (value !== null) return value;
    } catch {
      // fall through to localStorage
    }
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setPersistentSetting(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && window.api?.setStoredSetting) {
    window.api.setStoredSetting(key, value).catch(() => {
      // best-effort; the localStorage write above still covers this session
    });
  }
}
