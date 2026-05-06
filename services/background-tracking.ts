import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import {
  fetchDeviceStatus,
  getOrCreateDeviceUuid,
  getSavedToken,
  submitLocationPayload,
} from '@/services/mobile-device';

const ACTIVE_SEARCH_TASK = 'active-search-location-task';

type LocationTaskData = {
  locations?: Location.LocationObject[];
};

TaskManager.defineTask<LocationTaskData>(ACTIVE_SEARCH_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('Background tracking task failed.', error);
    return;
  }

  const latest = data?.locations?.at(-1);
  if (!latest) {
    return;
  }

  const token = await getSavedToken();
  const deviceUuid = await getOrCreateDeviceUuid();

  if (!token || !deviceUuid) {
    return;
  }

  const status = await fetchDeviceStatus(token, deviceUuid).catch(() => null);
  const live = status?.tracking_enabled && status.is_lost && status.tracking_mode === 'live';

  if (!live) {
    await stopActiveSearchBackgroundTracking();
    return;
  }

  const battery = await Battery.getBatteryLevelAsync().catch(() => null);

  await submitLocationPayload(token, deviceUuid, {
    latitude: latest.coords.latitude,
    longitude: latest.coords.longitude,
    accuracy: latest.coords.accuracy,
    speed: latest.coords.speed,
    battery_level: battery !== null ? Math.round(battery * 100) : null,
    recorded_at: new Date(latest.timestamp).toISOString(),
    tracking_mode: 'live',
  }).catch((submitError) => {
    console.warn('Unable to submit background location.', submitError);
  });
});

export async function startActiveSearchBackgroundTracking(intervalSeconds: number) {
  if (Platform.OS === 'web') {
    return false;
  }

  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    return false;
  }

  const background = await Location.getBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    return false;
  }

  const started = await Location.hasStartedLocationUpdatesAsync(ACTIVE_SEARCH_TASK);
  if (started) {
    return true;
  }

  await Location.startLocationUpdatesAsync(ACTIVE_SEARCH_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: Math.max(intervalSeconds, 10) * 1000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Active Search Mode',
      notificationBody: 'Sending live location for this reported lost device.',
    },
    showsBackgroundLocationIndicator: true,
  });

  return true;
}

export async function stopActiveSearchBackgroundTracking() {
  if (Platform.OS === 'web') {
    return;
  }

  const started = await Location.hasStartedLocationUpdatesAsync(ACTIVE_SEARCH_TASK);
  if (started) {
    await Location.stopLocationUpdatesAsync(ACTIVE_SEARCH_TASK);
  }
}
