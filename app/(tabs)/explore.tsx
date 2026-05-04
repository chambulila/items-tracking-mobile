import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { apiRequest } from '@/constants/api';

type DeviceStatus = {
  device_id: number;
  tracking_enabled: boolean;
  is_lost: boolean;
  should_send_location: boolean;
  poll_after_seconds: number;
};

export default function DeviceTrackingScreen() {
  const [token, setToken] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [latitude, setLatitude] = useState('-6.7924');
  const [longitude, setLongitude] = useState('39.2083');
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [message, setMessage] = useState('Waiting for device status.');

  const pollStatus = useCallback(async () => {
    if (!token || !deviceId) {
      return;
    }

    try {
      const nextStatus = await apiRequest<DeviceStatus>(`/devices/${deviceId}/status`, token);
      setStatus(nextStatus);
      setMessage(nextStatus.should_send_location ? 'Location updates are allowed.' : 'Tracking is paused by backend rules.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to poll device status.');
    }
  }, [deviceId, token]);

  useEffect(() => {
    pollStatus();
    const interval = setInterval(pollStatus, 20000);

    return () => clearInterval(interval);
  }, [pollStatus]);

  const sendLocation = async () => {
    if (!status?.should_send_location) {
      Alert.alert('Tracking paused', 'The backend only accepts locations when tracking is enabled and the device is marked lost.');
      return;
    }

    try {
      await apiRequest(`/devices/${deviceId}/location`, token, {
        method: 'POST',
        body: JSON.stringify({
          latitude: Number(latitude),
          longitude: Number(longitude),
          recorded_at: new Date().toISOString(),
        }),
      });
      setMessage('Location update sent.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to send location.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>Optional GPS</Text>
      <Text style={styles.title}>Device tracking poller</Text>
      <Text style={styles.copy}>
        The mobile app polls the backend every 20 seconds. It only submits coordinates when
        <Text style={styles.bold}> tracking_enabled </Text>
        and
        <Text style={styles.bold}> is_lost </Text>
        are both true.
      </Text>

      <View style={styles.card}>
        <TextInput autoCapitalize="none" onChangeText={setToken} placeholder="API token" secureTextEntry style={styles.input} value={token} />
        <TextInput keyboardType="number-pad" onChangeText={setDeviceId} placeholder="Device ID" style={styles.input} value={deviceId} />
        <View style={styles.row}>
          <TextInput keyboardType="decimal-pad" onChangeText={setLatitude} placeholder="Latitude" style={[styles.input, styles.coordinate]} value={latitude} />
          <TextInput keyboardType="decimal-pad" onChangeText={setLongitude} placeholder="Longitude" style={[styles.input, styles.coordinate]} value={longitude} />
        </View>
        <Pressable onPress={pollStatus} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Poll status now</Text>
        </Pressable>
        <Pressable onPress={sendLocation} style={[styles.button, !status?.should_send_location && styles.buttonDisabled]}>
          <Text style={styles.buttonText}>Send location</Text>
        </Pressable>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Backend status</Text>
        <Text style={styles.statusText}>{message}</Text>
        <Text style={styles.pill}>tracking: {status?.tracking_enabled ? 'enabled' : 'disabled'}</Text>
        <Text style={styles.pill}>lost: {status?.is_lost ? 'yes' : 'no'}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bold: {
    fontWeight: '900',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#8f3d2d',
    borderRadius: 18,
    padding: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff8e9',
    fontSize: 16,
    fontWeight: '900',
  },
  card: {
    backgroundColor: '#fffdf6',
    borderColor: '#d5bfa0',
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  container: {
    backgroundColor: '#e8d4bd',
    gap: 22,
    minHeight: '100%',
    padding: 24,
    paddingTop: 72,
  },
  coordinate: {
    flex: 1,
  },
  copy: {
    color: '#493d35',
    fontSize: 16,
    lineHeight: 24,
  },
  eyebrow: {
    color: '#8f3d2d',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#d5bfa0',
    borderRadius: 16,
    borderWidth: 1,
    color: '#251f17',
    padding: 14,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff8e9',
    borderRadius: 999,
    color: '#493d35',
    fontWeight: '800',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#8f3d2d',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  secondaryText: {
    color: '#8f3d2d',
    fontSize: 16,
    fontWeight: '900',
  },
  statusCard: {
    backgroundColor: '#2b463d',
    borderRadius: 28,
    padding: 18,
  },
  statusLabel: {
    color: '#cbbf9b',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  statusText: {
    color: '#fff8e9',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
    marginTop: 8,
  },
  title: {
    color: '#251f17',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 44,
  },
});
