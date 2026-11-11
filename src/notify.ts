export function notificationsSupported(): boolean {
  return typeof Notification !== 'undefined';
}

export async function askNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  return Notification.requestPermission();
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    /* ignora */
  }
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: './icon-192.png', badge: './icon-192.png' });
    else new Notification(title, { body, icon: './icon-192.png' });
  } catch {
    /* alguns navegadores móveis só aceitam showNotification */
  }
}
