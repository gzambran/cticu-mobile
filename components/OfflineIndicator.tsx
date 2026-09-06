import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface OfflineIndicatorProps {
  reason?: 'offline' | 'server';
}

// One message per connection state, identical on every screen. Whether a given screen
// has data to show is that screen's own concern and belongs in its empty state.
export default function OfflineIndicator({ reason = 'offline' }: OfflineIndicatorProps) {
  const icon = reason === 'server' ? 'alert-circle-outline' : 'cloud-offline-outline';
  const text = reason === 'server'
    ? 'Trouble connecting - Try again later'
    : 'No internet connection';

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={16} color="#8E8E93" />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  text: {
    fontSize: 13,
    color: '#8E8E93',
  },
});
