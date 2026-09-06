import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface OfflineIndicatorProps {
  reason?: 'offline' | 'server';
  cached?: boolean;
}

export default function OfflineIndicator({ reason = 'offline', cached = true }: OfflineIndicatorProps) {
  const icon = reason === 'server' ? 'alert-circle-outline' : 'cloud-offline-outline';
  const text = reason === 'server'
    ? (cached ? 'Showing saved data' : 'Unable to load - Try again later')
    : (cached ? 'No internet connection - Showing saved data' : 'No internet connection - Unable to load');

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
