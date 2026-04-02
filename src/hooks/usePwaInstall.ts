import { useCallback, useEffect, useState } from 'react';
import { consumePwaInstallPrompt, subscribePwaInstallPrompt } from '@/lib/pwaInstallPrompt';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    setIsInstalled(isStandaloneMode());

    return subscribePwaInstallPrompt((event) => {
      setInstallPrompt(event);
      if (event) {
        setIsInstalled(false);
      }
    });
  }, []);

  const install = useCallback(async () => {
    const prompt = consumePwaInstallPrompt();
    if (!prompt) return false;

    setInstallPrompt(null);
    setIsInstalling(true);
    await prompt.prompt();
    const result = await prompt.userChoice.catch(() => null);
    setIsInstalling(false);

    if (result?.outcome === 'accepted') {
      setIsInstalled(true);
      return true;
    }

    return false;
  }, []);

  return {
    canInstall: Boolean(installPrompt) && !isInstalled,
    isInstalled,
    isInstalling,
    install,
  };
}
