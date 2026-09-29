/**
 * Displays a native LOONIST platform dialog or falls back to standard alert.
 * Ensures the application title is consistently 'LOONIST'.
 */
export async function showLoonistDialog(message: string, title: string = 'LOONIST'): Promise<void> {
  if (typeof window !== 'undefined' && window.api?.showMessageBox) {
    try {
      await window.api.showMessageBox(message, title);
      return;
    } catch {
      // Fallback if IPC fails
    }
  }
  if (typeof window !== 'undefined') {
    window.alert(message);
  }
}
