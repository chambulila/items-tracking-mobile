import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { apiRequest } from '@/constants/api';

type References = {
  campuses: { id: number; name: string }[];
  item_categories: { id: number; name: string }[];
  incident_categories: { id: number; name: string }[];
};

export default function ReportsScreen() {
  const [token, setToken] = useState('');
  const [references, setReferences] = useState<References | null>(null);
  const [busy, setBusy] = useState(false);

  const loadReferences = async () => {
    setBusy(true);
    try {
      setReferences(await apiRequest<References>('/references', token));
    } catch (error) {
      Alert.alert('Request failed', error instanceof Error ? error.message : 'Unable to load data');
    } finally {
      setBusy(false);
    }
  };

  const submitLostItem = async () => {
    if (!references) {
      Alert.alert('References required', 'Load reference data first.');
      return;
    }

    setBusy(true);
    try {
      await apiRequest('/lost-items', token, {
        method: 'POST',
        body: JSON.stringify({
          item_category_id: references.item_categories[0]?.id,
          campus_id: references.campuses[0]?.id,
          name: 'Mobile phone',
          description: 'Black phone reported from the mobile app.',
          color: 'black',
          brand_model: 'Generic phone',
          lost_date: new Date().toISOString().slice(0, 10),
          latitude: -6.7924,
          longitude: 39.2083,
        }),
      });
      Alert.alert('Submitted', 'Lost item report was sent.');
    } catch (error) {
      Alert.alert('Request failed', error instanceof Error ? error.message : 'Unable to submit report');
    } finally {
      setBusy(false);
    }
  };

  const submitIncident = async () => {
    if (!references) {
      Alert.alert('References required', 'Load reference data first.');
      return;
    }

    setBusy(true);
    try {
      await apiRequest('/incidents', token, {
        method: 'POST',
        body: JSON.stringify({
          incident_category_id: references.incident_categories[0]?.id,
          campus_id: references.campuses[0]?.id,
          description: 'Suspicious activity reported from the mobile app.',
          severity: 'medium',
          latitude: -6.7924,
          longitude: 39.2083,
        }),
      });
      Alert.alert('Submitted', 'Incident report was sent.');
    } catch (error) {
      Alert.alert('Request failed', error instanceof Error ? error.message : 'Unable to submit incident');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>Digital Tracking</Text>
      <Text style={styles.title}>Report lost items and campus incidents</Text>
      <Text style={styles.copy}>
        Paste a bearer token from the Laravel API, load reference data, then submit a sample report.
        The backend validates required fields, ownership, coordinates, and role restrictions.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>API token</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={setToken}
          placeholder="Bearer token"
          secureTextEntry
          style={styles.input}
          value={token}
        />
        <Pressable disabled={!token || busy} onPress={loadReferences} style={styles.button}>
          <Text style={styles.buttonText}>{busy ? 'Working...' : 'Load references'}</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        <Pressable disabled={!references || busy} onPress={submitLostItem} style={styles.action}>
          <Text style={styles.actionTitle}>Lost item</Text>
          <Text style={styles.actionCopy}>Submit item details with map coordinates.</Text>
        </Pressable>
        <Pressable disabled={!references || busy} onPress={submitIncident} style={styles.action}>
          <Text style={styles.actionTitle}>Incident</Text>
          <Text style={styles.actionCopy}>Submit severity, location, and description.</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  action: {
    backgroundColor: '#f8f3e8',
    borderColor: '#decfae',
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    minWidth: 150,
    padding: 18,
  },
  actionCopy: {
    color: '#655b4b',
    fontSize: 14,
    lineHeight: 20,
  },
  actionTitle: {
    color: '#251f17',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#2d5f53',
    borderRadius: 18,
    padding: 14,
  },
  buttonText: {
    color: '#fff8e9',
    fontSize: 16,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#fff8e9',
    borderColor: '#e1d2ad',
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  container: {
    backgroundColor: '#f0e4c9',
    gap: 22,
    minHeight: '100%',
    padding: 24,
    paddingTop: 72,
  },
  copy: {
    color: '#4b463b',
    fontSize: 16,
    lineHeight: 24,
  },
  eyebrow: {
    color: '#8d4b2d',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#d6c59d',
    borderRadius: 16,
    borderWidth: 1,
    color: '#251f17',
    padding: 14,
  },
  label: {
    color: '#4b463b',
    fontWeight: '800',
  },
  title: {
    color: '#251f17',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 44,
  },
});
