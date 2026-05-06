import * as Application from 'expo-application';
import * as Battery from 'expo-battery';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { apiRequest } from '@/constants/api';

const DEVICE_UUID_KEY = 'tracking.device_uuid';
const TOKEN_KEY = 'tracking.api_token';
const memoryStore = new Map<string, string>();

export type PermissionStatus = 'unknown' | 'granted' | 'denied' | 'foreground' | 'background';
export type TrackingMode = 'idle' | 'heartbeat' | 'live';

export type MobileDevice = {
  id: number;
  device_uuid: string;
  name: string;
  tracking_enabled: boolean;
  is_lost: boolean;
  tracking_mode: TrackingMode;
  location_permission_status: PermissionStatus;
};

export type DeviceStatus = {
  device_uuid: string;
  tracking_enabled: boolean;
  is_lost: boolean;
  tracking_mode: TrackingMode;
  polling_interval_seconds: number;
  heartbeat_interval_minutes: number;
  location_permission_status: PermissionStatus;
};

function canUseWebStorage() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

async function setStoredValue(key: string, value: string) {
  if (canUseWebStorage()) {
    window.localStorage.setItem(key, value);
    return;
  }

  if (Platform.OS === 'web') {
    memoryStore.set(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function getStoredValue(key: string) {
  if (canUseWebStorage()) {
    return window.localStorage.getItem(key);
  }

  if (Platform.OS === 'web') {
    return memoryStore.get(key) ?? null;
  }

  return SecureStore.getItemAsync(key);
}

async function deleteStoredValue(key: string) {
  if (canUseWebStorage()) {
    window.localStorage.removeItem(key);
    return;
  }

  if (Platform.OS === 'web') {
    memoryStore.delete(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function saveToken(token: string) {
  await setStoredValue(TOKEN_KEY, token);
}

export async function getSavedToken() {
  return getStoredValue(TOKEN_KEY);
}

export async function clearToken() {
  await deleteStoredValue(TOKEN_KEY);
}

export async function getOrCreateDeviceUuid() {
  const existing = await getStoredValue(DEVICE_UUID_KEY);
  if (existing) {
    return existing;
  }

  const uuid = Crypto.randomUUID();
  await setStoredValue(DEVICE_UUID_KEY, uuid);

  return uuid;
}

function deviceTypeName() {
  if (Device.deviceType === Device.DeviceType.TABLET) {
    return 'tablet';
  }

  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return 'phone';
  }

  return 'laptop';
}

export async function syncDevice(token: string, permissionStatus: PermissionStatus = 'unknown') {
  const deviceUuid = await getOrCreateDeviceUuid();

  return apiRequest<MobileDevice>('/mobile/devices/sync', token, {
    method: 'POST',
    body: JSON.stringify({
      device_uuid: deviceUuid,
      device_name: Device.deviceName ?? `${Device.brand ?? 'Mobile'} ${Device.modelName ?? 'Device'}`,
      device_type: deviceTypeName(),
      brand: Device.brand ?? null,
      model: Device.modelName ?? null,
      os_name: Device.osName ?? Platform.OS,
      os_version: Device.osVersion ?? null,
      app_version: Application.nativeApplicationVersion ?? '1.0.0',
      location_permission_status: permissionStatus,
    }),
  });
}

export async function requestLocationPermission(token: string, deviceUuid: string): Promise<PermissionStatus> {
  const foreground = await Location.requestForegroundPermissionsAsync();

  if (foreground.status !== 'granted') {
    await reportPermissionStatus(token, deviceUuid, 'denied');
    return 'denied';
  }

  let status: PermissionStatus = 'foreground';

  if (Platform.OS === 'android') {
    const background = await Location.requestBackgroundPermissionsAsync();
    status = background.status === 'granted' ? 'background' : 'foreground';
  }

  await reportPermissionStatus(token, deviceUuid, status);
  return status;
}

export async function reportPermissionStatus(token: string, deviceUuid: string, status: PermissionStatus) {
  return apiRequest<MobileDevice>(`/mobile/devices/${deviceUuid}/permission-status`, token, {
    method: 'POST',
    body: JSON.stringify({ location_permission_status: status }),
  });
}

export async function fetchDeviceStatus(token: string, deviceUuid: string) {
  return apiRequest<DeviceStatus>(`/mobile/devices/${deviceUuid}/status`, token);
}

export async function submitLocationPayload(
  token: string,
  deviceUuid: string,
  payload: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    speed?: number | null;
    battery_level?: number | null;
    recorded_at: string;
    tracking_mode: 'heartbeat' | 'live';
  },
) {
  return apiRequest(`/mobile/devices/${deviceUuid}/location`, token, {
    method: 'POST',
    body: JSON.stringify({
      device_uuid: deviceUuid,
      ...payload,
    }),
  });
}

export async function sendCurrentLocation(token: string, deviceUuid: string, trackingMode: 'heartbeat' | 'live') {
  const position = await Location.getCurrentPositionAsync({
    accuracy: trackingMode === 'live' ? Location.Accuracy.High : Location.Accuracy.Balanced,
  });
  const battery = await Battery.getBatteryLevelAsync().catch(() => null);

  return submitLocationPayload(token, deviceUuid, {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    speed: position.coords.speed,
    battery_level: battery !== null ? Math.round(battery * 100) : null,
    recorded_at: new Date(position.timestamp).toISOString(),
    tracking_mode: trackingMode,
  });
}
