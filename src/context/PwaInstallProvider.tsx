import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

/** Where installing is a walk through the browser's own menus; `other` is a browser we cannot name. */
export type ManualInstall = 'ios' | 'macosSafari' | 'firefoxAndroid' | 'other';

interface PwaInstallContextValue {
  canInstall: boolean;
  /** Set while the app is not installed and the browser has handed over no prompt. */
  manualInstall: ManualInstall | null;
  install: () => Promise<void>;
}

const unavailableInstall = async () => undefined;
const PwaInstallContext = createContext<PwaInstallContextValue>({
  canInstall: false,
  manualInstall: null,
  install: unavailableInstall,
});

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    navigatorWithStandalone.standalone === true
  );
}

// Sniffed because no browser reports "installable by hand"; a wrong guess only picks the wording.
function detectManualInstall(): ManualInstall {
  const ua = navigator.userAgent;
  // Every browser on iOS is WebKit and installs through Share; an iPad claims to be a Mac.
  if (/iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (ua.includes('Android') && ua.includes('Firefox')) return 'firefoxAndroid';
  if (ua.includes('Macintosh') && ua.includes('Safari') && !/Chrome|Chromium|Edg|OPR/.test(ua)) {
    return 'macosSafari';
  }
  return 'other';
}

/** Captures Chromium's one-shot install prompt while the app is mounted. */
export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const displayMode = window.matchMedia?.('(display-mode: standalone)');
    const handleDisplayModeChange = (event: MediaQueryListEvent) => setInstalled(event.matches);
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    displayMode?.addEventListener('change', handleDisplayModeChange);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      displayMode?.removeEventListener('change', handleDisplayModeChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt || installed) return;

    setInstallPrompt(null);
    await installPrompt.prompt();
  }, [installPrompt, installed]);

  const value = useMemo(() => {
    const canInstall = installPrompt !== null && !installed;
    return {
      canInstall,
      manualInstall: canInstall || installed ? null : detectManualInstall(),
      install,
    };
  }, [installPrompt, installed, install]);

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstall() {
  return useContext(PwaInstallContext);
}
