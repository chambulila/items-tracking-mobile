import { useCallback, useEffect, useRef, useState } from 'react';

import {
  startActiveSearchBackgroundTracking,
  stopActiveSearchBackgroundTracking,
} from '@/services/background-tracking';
import {
  DeviceStatus,
  fetchDeviceStatus,
  PermissionStatus,
  sendCurrentLocation,
} from '@/services/mobile-device';

type TrackingMessage = {
  kind: 'idle' | 'heartbeat' | 'live' | 'error';
  text: string;
};

export function useTrackingLoop(token: string | null, deviceUuid: string | null, permissionStatus: PermissionStatus) {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [pollingSeconds, setPollingSeconds] = useState(20);
  const [message, setMessage] = useState<TrackingMessage>({ kind: 'idle', text: 'Waiting for device sync.' });
  const lastHeartbeatAt = useRef<number>(0);
  const lastLiveAt = useRef<number>(0);
  const statusRef = useRef<DeviceStatus | null>(null);

  const sendTrackingTick = useCallback(async () => {
    if (!token || !deviceUuid || permissionStatus === 'denied') {
      await stopActiveSearchBackgroundTracking().catch(() => {});
      return;
    }

    const currentStatus = statusRef.current;
    if (!currentStatus) {
      return;
    }

    const now = Date.now();
    const live = currentStatus.tracking_enabled && currentStatus.is_lost && currentStatus.tracking_mode === 'live';

    try {
      if (live && now - lastLiveAt.current >= 10000) {
        await startActiveSearchBackgroundTracking(currentStatus.polling_interval_seconds);
        await sendCurrentLocation(token, deviceUuid, 'live');
        lastLiveAt.current = Date.now();
        setMessage({ kind: 'live', text: 'Live location update sent.' });
        return;
      }

      await stopActiveSearchBackgroundTracking();

      const heartbeatMs = Math.max(currentStatus.heartbeat_interval_minutes, 15) * 60 * 1000;
      if (!live && now - lastHeartbeatAt.current >= heartbeatMs) {
        await sendCurrentLocation(token, deviceUuid, 'heartbeat');
        lastHeartbeatAt.current = Date.now();
        setMessage({ kind: 'heartbeat', text: 'Heartbeat location update sent.' });
      }
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to send location.' });
    }
  }, [deviceUuid, permissionStatus, token]);

  const poll = useCallback(async () => {
    if (!token || !deviceUuid) {
      return;
    }

    try {
      const nextStatus = await fetchDeviceStatus(token, deviceUuid);
      statusRef.current = nextStatus;
      setStatus(nextStatus);
      setPollingSeconds(Math.max(nextStatus.polling_interval_seconds, 10));
      const live = nextStatus.tracking_enabled && nextStatus.is_lost && nextStatus.tracking_mode === 'live';
      setMessage({
        kind: live ? 'live' : 'heartbeat',
        text: live ? 'Active Search Mode is enabled. Sending live updates.' : 'Heartbeat mode. Sending low-frequency last known location.',
      });

      if (live) {
        void sendTrackingTick();
      }
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to poll tracking status.' });
    }
  }, [deviceUuid, sendTrackingTick, token]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, pollingSeconds * 1000);

    return () => clearInterval(interval);
  }, [poll, pollingSeconds]);

  useEffect(() => {
    if (!token || !deviceUuid || permissionStatus === 'denied') {
      stopActiveSearchBackgroundTracking().catch(() => {});
      return;
    }

    const interval = setInterval(sendTrackingTick, 3000);

    return () => {
      clearInterval(interval);
      stopActiveSearchBackgroundTracking().catch(() => {});
    };
  }, [deviceUuid, permissionStatus, sendTrackingTick, token]);

  const sendHeartbeatNow = useCallback(async () => {
    if (!token || !deviceUuid || permissionStatus === 'denied') {
      return;
    }

    await sendCurrentLocation(token, deviceUuid, 'heartbeat');
    lastHeartbeatAt.current = Date.now();
    setMessage({ kind: 'heartbeat', text: 'Heartbeat location update sent.' });
  }, [deviceUuid, permissionStatus, token]);

  return { status, message, poll, sendHeartbeatNow };
}
