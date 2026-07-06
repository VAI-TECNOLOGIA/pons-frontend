// capStorage — espelha a auth em armazenamento NATIVO (Capacitor Preferences =
// SharedPreferences no Android / UserDefaults no iOS). O SO não limpa isso
// enquanto o app estiver instalado, ao contrário do localStorage da WebView
// (que Android zera sob pressão de memória e iOS pode descartar em background).
// No navegador (web) é 100% no-op.
//
// Usa a bridge global window.Capacitor (não importa o plugin em build-time) —
// portável e seguro mesmo se o plugin não estiver presente.

interface CapBridge {
  isNativePlatform?: () => boolean;
  Plugins?: {
    Preferences?: {
      get: (o: { key: string }) => Promise<{ value: string | null }>;
      set: (o: { key: string; value: string }) => Promise<void>;
      remove: (o: { key: string }) => Promise<void>;
    };
  };
}

function getPreferences() {
  const c = (window as unknown as { Capacitor?: CapBridge }).Capacitor;
  if (!c?.isNativePlatform || !c.isNativePlatform()) return null;
  return c.Plugins?.Preferences ?? null;
}

export function isCapacitorNative(): boolean {
  return getPreferences() !== null;
}

export async function capStorageGet(key: string): Promise<string | null> {
  const p = getPreferences();
  if (!p) return null;
  try {
    const { value } = await p.get({ key });
    return value ?? null;
  } catch {
    return null;
  }
}

export function capStorageSet(key: string, value: string): void {
  const p = getPreferences();
  if (!p) return;
  p.set({ key, value }).catch(() => {});
}

export function capStorageRemove(key: string): void {
  const p = getPreferences();
  if (!p) return;
  p.remove({ key }).catch(() => {});
}
