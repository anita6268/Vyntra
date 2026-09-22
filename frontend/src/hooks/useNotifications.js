const NOTIFICATIONS_KEY = "vyntra-notifications-enabled";

function getStoredPref() {
  try {
    return localStorage.getItem(NOTIFICATIONS_KEY) === "true";
  } catch {
    return false;
  }
}

function setStoredPref(value) {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, String(value));
  } catch {
    // ignore
  }
}

function isNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

function requestPermission() {
  if (!isNotificationSupported()) {
    return Promise.resolve("unsupported");
  }
  if (Notification.permission === "granted") {
    return Promise.resolve("granted");
  }
  if (Notification.permission === "denied") {
    return Promise.resolve("denied");
  }
  return Notification.requestPermission();
}

function showBrowserNotification(title, options = {}) {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== "granted") return;

  try {
    const n = new Notification(title, {
      icon: "/vite.svg",
      badge: "/vite.svg",
      ...options,
    });
    n.addEventListener("click", () => {
      if (options.onClick) options.onClick();
      n.close();
    });
    n.addEventListener("error", () => {
      n.close();
    });
  } catch {
    // fail silently
  }
}

function useNotifications() {
  const enabled = getStoredPref();

  const requestAndEnable = async () => {
    const result = await requestPermission();
    const granted = result === "granted";
    setStoredPref(granted);
    return granted;
  };

  const disable = () => {
    setStoredPref(false);
  };

  const notify = (title, options = {}) => {
    if (!enabled) return;
    showBrowserNotification(title, options);
  };

  const test = () => {
    if (!enabled) return;
    showBrowserNotification("Vyntra", {
      body: "Test notification — your notifications are working!",
      requireInteraction: false,
    });
  };

  return {
    enabled,
    supported: isNotificationSupported(),
    permission: isNotificationSupported() ? Notification.permission : "unsupported",
    requestAndEnable,
    disable,
    notify,
    test,
  };
}

export default useNotifications;
