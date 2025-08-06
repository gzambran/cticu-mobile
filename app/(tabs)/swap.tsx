import SwapRequestModal from '@/components/SwapRequestModal';
import { useAuth } from '@/contexts/AuthContext';
import { useDoctors } from '@/contexts/DoctorsContext';
import api from '@/services/api';
import { ShiftChange, ShiftChangeRequest } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function SwapScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { doctors } = useDoctors();
  const [requests, setRequests] = useState<ShiftChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'mine' | 'admin'>('mine');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await api.getShiftChangeRequests();
      setRequests(data || []);
    } catch (error) {
      console.error('Error loading shift swap requests:', error);
      // For now, let's set empty array instead of showing error
      setRequests([]);
      // Only show error on initial load, not refresh
      if (!isRefresh) {
        Alert.alert('Note', 'No shift swap requests found');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateSwap = async (shifts: ShiftChange[], notes?: string) => {
    try {
      await api.createShiftChangeRequest(shifts, notes);
      Alert.alert('Success', 'Shift swap request submitted');
      loadRequests();
      setShowCreateModal(false);
    } catch (error) {
      throw error; // Let the modal handle the error
    }
  };

  const handleApprove = async (requestId: number) => {
    Alert.alert(
      'Approve Swap',
      'Are you sure you want to approve this shift swap?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            try {
              await api.approveShiftChangeRequest(requestId);
              Alert.alert('Success', 'Shift swap approved');
              loadRequests();
            } catch (error) {
              Alert.alert('Error', 'Failed to approve shift swap');
            }
          },
        },
      ]
    );
  };

  const handleDeny = async (requestId: number) => {
    Alert.alert(
      'Deny Swap',
      'Are you sure you want to deny this shift swap?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deny',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.denyShiftChangeRequest(requestId);
              Alert.alert('Success', 'Shift swap denied');
              loadRequests();
            } catch (error) {
              Alert.alert('Error', 'Failed to deny shift swap');
            }
          },
        },
      ]
    );
  };

  const filteredRequests = requests.filter((request) => {
    if (viewMode === 'mine') {
      // Show user's own requests and incoming swaps
      return (
        request.requester_username === user?.username ||
        request.shifts.some(shift => shift.to_doctor === user?.fullName || shift.to_doctor === user?.username)
      );
    } else {
      // Admin view - show all requests (they're already filtered to pending on backend)
      return true;
    }
  });

  const renderRequest = (request: ShiftChangeRequest) => {
    const isPending = request.status === 'pending';
    const canApprove = isAdmin && isPending && viewMode === 'admin';

    return (
      <View key={request.id} style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.requestInfo}>
            <Text style={styles.requestTitle}>
              {request.requester_name || request.requester_username}
            </Text>
            <Text style={styles.requestDate}>
              {new Date(request.submitted_at).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              })}
            </Text>
          </View>
          <View style={[
            styles.statusBadge,
            request.status === 'approved' && styles.approvedBadge,
            request.status === 'denied' && styles.deniedBadge,
          ]}>
            <Text style={styles.statusText}>
              {request.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.requestBody}>
          {request.shifts.map((shift, index) => (
            <View key={index} style={styles.shiftRow}>
              <Text style={styles.shiftText}>
                {new Date(shift.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' • '}
                {shift.shift_type}
                {': '}
                {shift.from_doctor} → {shift.to_doctor}
              </Text>
            </View>
          ))}
          
          {request.notes && (
            <Text style={styles.notesText}>Notes: {request.notes}</Text>
          )}
        </View>

        {canApprove && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprove(request.id)}
            >
              <Text style={styles.approveButtonText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.denyButton]}
              onPress={() => handleDeny(request.id)}
            >
              <Text style={styles.denyButtonText}>Deny</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.statusBarBackground, { height: insets.top }]} />
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.statusBarBackground, { height: insets.top }]} />
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shift Swaps</Text>
      </View>

      {isAdmin && (
        <View style={styles.segmentControl}>
          <TouchableOpacity
            style={[styles.segment, viewMode === 'mine' && styles.activeSegment]}
            onPress={() => setViewMode('mine')}
          >
            <Text style={[styles.segmentText, viewMode === 'mine' && styles.activeSegmentText]}>
              My Swaps
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, viewMode === 'admin' && styles.activeSegment]}
            onPress={() => setViewMode('admin')}
          >
            <Text style={[styles.segmentText, viewMode === 'admin' && styles.activeSegmentText]}>
              Admin View
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRequests(true)}
            tintColor="#007AFF"
          />
        }
      >
        {viewMode === 'mine' && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add-circle" size={24} color="white" />
            <Text style={styles.createButtonText}>New Swap Request</Text>
          </TouchableOpacity>
        )}

        {filteredRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {viewMode === 'admin' 
                ? 'No pending swap requests to review' 
                : 'No shift swap requests'}
            </Text>
          </View>
        ) : (
          filteredRequests.map(renderRequest)
        )}
      </ScrollView>

      <SwapRequestModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateSwap}
        doctors={doctors}
        currentUser={user}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  statusBarBackground: {
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeSegment: {
    backgroundColor: '#007AFF',
  },
  segmentText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
  },
  activeSegmentText: {
    color: 'white',
  },
  scrollView: {
    flex: 1,
  },
  createButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
  requestCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  requestInfo: {
    flex: 1,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  requestDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  statusBadge: {
    backgroundColor: '#FFA500',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  approvedBadge: {
    backgroundColor: '#34C759',
  },
  deniedBadge: {
    backgroundColor: '#FF3B30',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  requestBody: {
    padding: 16,
  },
  shiftRow: {
    marginBottom: 8,
  },
  shiftText: {
    fontSize: 15,
    color: '#000',
  },
  notesText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingTop: 0,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#34C759',
  },
  denyButton: {
    backgroundColor: '#FF3B30',
  },
  approveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  denyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});

export default SwapScreen;