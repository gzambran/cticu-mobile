import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function OfflineIndicator() {
  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={16} color="#8E8E93" />
      <Text style={styles.text}>Offline - Showing cached data</Text>
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