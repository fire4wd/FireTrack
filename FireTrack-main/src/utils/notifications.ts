import { ReminderNotificationSettings } from '../types/ontrack';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

/**
 * Checks if Notification API is available in current browser environment.
 */
export const isNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

/**
 * Gets the current notification permission state.
 */
export const getNotificationPermission = (): NotificationPermissionStatus => {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionStatus;
};

/**
 * Requests notification permission from the user.
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!isNotificationSupported()) {
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (e) {
    console.warn('Error requesting notification permission:', e);
    return false;
  }
};

/**
 * Play a gentle medical/reminder chime using the Web Audio API.
 * Does not require external audio assets.
 */
export const playReminderChime = (): void => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // First tone (523.25 Hz = C5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Second tone (659.25 Hz = E5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.15);
    gain2.gain.setValueAtTime(0, now + 0.15);
    gain2.gain.linearRampToValueAtTime(0.18, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.7);

    // Third harmonizing tone (783.99 Hz = G5)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(783.99, now + 0.3);
    gain3.gain.setValueAtTime(0, now + 0.3);
    gain3.gain.linearRampToValueAtTime(0.2, now + 0.35);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.3);
    osc3.stop(now + 1.0);
  } catch (e) {
    console.debug('Audio chime unable to play:', e);
  }
};

/**
 * Triggers a Web Notification.
 */
export const triggerPushNotification = (
  title: string, 
  body: string, 
  playAudio: boolean = true
): boolean => {
  if (playAudio) {
    playReminderChime();
  }

  if (!isNotificationSupported()) {
    return false;
  }

  if (Notification.permission === 'granted') {
    try {
      const options: NotificationOptions = {
        body,
        icon: '/favicon.svg',
        tag: 'ontrack-reminder',
        badge: '/favicon.svg',
        silent: !playAudio,
      };

      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      return true;
    } catch (e) {
      console.warn('Could not display system Notification object, fallback active:', e);
      return false;
    }
  }
  return false;
};

const LAST_REMINDER_KEY = 'ontrack_last_reminder_date_v1';

/**
 * Checks if the reminder should trigger now based on current time and settings.
 * Returns true if reminder was fired.
 */
export const checkAndTriggerScheduledReminder = (
  settings?: ReminderNotificationSettings,
  patientName: string = 'Angelo'
): boolean => {
  if (!settings || !settings.enabled || !settings.time) {
    return false;
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Check if current day of week is configured
  if (settings.daysOfWeek && settings.daysOfWeek.length > 0) {
    if (!settings.daysOfWeek.includes(currentDay)) {
      return false;
    }
  }

  // Check time match (HH:mm)
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  // Normalized configured time
  const [configH, configM] = settings.time.split(':').map(v => parseInt(v || '0', 10));
  const normalizedConfigTime = `${String(configH).padStart(2, '0')}:${String(configM).padStart(2, '0')}`;

  if (currentTimeStr !== normalizedConfigTime) {
    return false;
  }

  // Prevent multiple triggers within the same minute on the same date
  const todayDateStr = `${now.toISOString().slice(0, 10)}_${currentTimeStr}`;
  const lastTriggered = localStorage.getItem(LAST_REMINDER_KEY);
  if (lastTriggered === todayDateStr) {
    return false; // Already fired this minute
  }

  // Set triggered mark
  localStorage.setItem(LAST_REMINDER_KEY, todayDateStr);

  const title = `⏰ OnTrack Promemoria Sanitario • ${patientName}`;
  const body = settings.message || 'Ricordati di registrare la glicemia e i tuoi parametri sanitari in OnTrack!';

  triggerPushNotification(title, body, settings.soundEnabled ?? true);
  return true;
};
