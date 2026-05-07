import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { login } from '@/constants/api';
import { useTrackingLoop } from '@/hooks/use-tracking-loop';
import {
  clearToken,
  getSavedToken,
  MobileDevice,
  PermissionStatus,
  requestLocationPermission,
  saveToken,
  syncDevice,
} from '@/services/mobile-device';

export default function TrackerScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [device, setDevice] = useState<MobileDevice | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('unknown');
  const [busy, setBusy] = useState(false);
  const { status, message, poll, sendHeartbeatNow } = useTrackingLoop(token, device?.device_uuid ?? null, permissionStatus);

  useEffect(() => {
    getSavedToken().then(async (savedToken) => {
      if (!savedToken) {
        return;
      }

      setToken(savedToken);

      try {
        const synced = await syncDevice(savedToken, permissionStatus);
        setDevice(synced);
        setPermissionStatus(synced.location_permission_status);
      } catch {
        await clearToken();
        setToken(null);
      }
    });
  }, [permissionStatus]);

  const handleLogin = async () => {
    setBusy(true);
    try {
      const response = await login(email, password);
      await saveToken(response.token);
      setToken(response.token);
      const synced = await syncDevice(response.token, permissionStatus);
      setDevice(synced);
      Alert.alert('Signed in', 'Device synced to your student account.');
    } catch (error) {
      Alert.alert('Login failed', error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    if (!token) {
      Alert.alert('Login required', 'Sign in before syncing the device.');
      return;
    }

    setBusy(true);
    try {
      const synced = await syncDevice(token, permissionStatus);
      setDevice(synced);
      Alert.alert('Device synced', 'This phone is linked to your account.');
    } catch (error) {
      Alert.alert('Sync failed', error instanceof Error ? error.message : 'Unable to sync device.');
    } finally {
      setBusy(false);
    }
  };

  const handlePermission = async () => {
    if (!token || !device) {
      Alert.alert('Device sync required', 'Sync your device before requesting permission.');
      return;
    }

    try {
      const nextStatus = await requestLocationPermission(token, device.device_uuid);
      setPermissionStatus(nextStatus);
      Alert.alert('Permission updated', `Location permission is ${nextStatus}.`);
    } catch (error) {
      Alert.alert('Permission failed', error instanceof Error ? error.message : 'Unable to update permission.');
    }
  };

  const handleLogout = async () => {
    await clearToken();
    setToken(null);
    setDevice(null);
    setPermissionStatus('unknown');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>University Tracker</Text>
      <Text style={styles.title}>Hybrid GPS tracking</Text>
      <Text style={styles.copy}>
        Sign in, sync this device, grant location permission, then the app will poll the backend and switch between heartbeat and live tracking.
      </Text>

      {!token ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Student Login</Text>
          <TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="Email" style={styles.input} value={email} />
          <TextInput onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} value={password} />
          <Pressable disabled={busy} onPress={handleLogin} style={styles.button}>
            <Text style={styles.buttonText}>{busy ? 'Signing in...' : 'Login and Sync Device'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Device Link</Text>
          <Text style={styles.statusLine}>Token stored securely.</Text>
          <Text style={styles.statusLine}>Device UUID: {device?.device_uuid ?? 'Not synced yet'}</Text>
          <View style={styles.row}>
            <Pressable disabled={busy} onPress={handleSync} style={[styles.secondaryButton, styles.flex]}>
              <Text style={styles.secondaryText}>Sync Device</Text>
            </Pressable>
            <Pressable onPress={handleLogout} style={[styles.dangerButton, styles.flex]}>
              <Text style={styles.buttonText}>Logout</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Location Permission</Text>
        <Text style={styles.copySmall}>
          Location is used to save last known campus location in heartbeat mode and to stream live GPS only when Active Search Mode is enabled.
        </Text>
        <Text style={styles.pill}>Permission: {permissionStatus}</Text>
        <Pressable disabled={!token || !device} onPress={handlePermission} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Request / Update Permission</Text>
        </Pressable>
      </View>

      <View style={[styles.card, message.kind === 'live' && styles.liveCard]}>
        <Text style={styles.sectionTitle}>Tracking Status</Text>
        <Text style={styles.statusLine}>Mode: {status?.tracking_mode ?? 'unknown'}</Text>
        <Text style={styles.statusLine}>Tracking: {status?.tracking_enabled ? 'enabled' : 'disabled'}</Text>
        <Text style={styles.statusLine}>Lost: {status?.is_lost ? 'yes' : 'no'}</Text>
        <Text style={styles.statusLine}>{message.text}</Text>
        <View style={styles.row}>
          <Pressable disabled={!token || !device} onPress={poll} style={[styles.secondaryButton, styles.flex]}>
            <Text style={styles.secondaryText}>Poll Now</Text>
          </Pressable>
          <Pressable disabled={!token || !device || permissionStatus === 'denied' || status?.tracking_enabled === false} onPress={sendHeartbeatNow} style={[styles.button, styles.flex]}>
            <Text style={styles.buttonText}>Send Heartbeat</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#1f6f5b',
    borderRadius: 16,
    padding: 14,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#d5dde5',
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  container: {
    backgroundColor: '#edf2f4',
    gap: 18,
    minHeight: '100%',
    padding: 22,
    paddingTop: 64,
  },
  copy: {
    color: '#40515d',
    fontSize: 16,
    lineHeight: 24,
  },
  copySmall: {
    color: '#40515d',
    fontSize: 14,
    lineHeight: 20,
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: '#a43f3f',
    borderRadius: 16,
    padding: 14,
  },
  eyebrow: {
    color: '#1f6f5b',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  flex: {
    flex: 1,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#ccd6dd',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  liveCard: {
    borderColor: '#d64545',
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: '#e7f5ef',
    borderRadius: 999,
    color: '#1f6f5b',
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#1f6f5b',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  secondaryText: {
    color: '#1f6f5b',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#17242c',
    fontSize: 20,
    fontWeight: '900',
  },
  statusLine: {
    color: '#2d3d46',
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: '#17242c',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
  },
});
