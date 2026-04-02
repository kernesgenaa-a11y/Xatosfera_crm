type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type PromptListener = (event: BeforeInstallPromptEvent | null) => void;

let installPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<PromptListener>();
let initialized = false;

function notifyListeners() {
  listeners.forEach((listener) => listener(installPrompt));
}

export function initPwaInstallPromptCapture() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    if (listeners.size === 0) {
      installPrompt = null;
      return;
    }
    event.preventDefault();
    installPrompt = event as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    notifyListeners();
  });
}

export function subscribePwaInstallPrompt(listener: PromptListener) {
  listeners.add(listener);
  listener(installPrompt);

  return () => {
    listeners.delete(listener);
  };
}

export function consumePwaInstallPrompt() {
  const prompt = installPrompt;
  installPrompt = null;
  notifyListeners();
  return prompt;
}
