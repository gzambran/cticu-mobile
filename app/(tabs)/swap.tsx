import SwapRequestForm from '@/components/SwapRequestForm';
import { useAuth } from '@/contexts/AuthContext';
import { useDoctors } from '@/contexts/DoctorsContext';
import api from '@/services/api';
import useNotificationStore from '@/stores/notificationStore';
import { ShiftChange, ShiftChangeRequest } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
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
  const [showCreateForm, setShowCreateForm] = useState(true); // Show form by default

  // Notification store hooks
  const markRequestAsSeen = useNotificationStore(state => state.markRequestAsSeen);
  const markAllRequestsAsSeen = useNotificationStore(state => state.markAllRequestsAsSeen);
  const fetchAndUpdateBadges = useNotificationStore(state => state.fetchAndUpdateBadges);

  const isAdmin = user?.role === 'admin';

  // Load requests on mount
  useEffect(() => {
    loadRequests();
  }, []);

  // Auto-collapse form if user has ANY involvement in existing swaps
  useEffect(() => {
    const userHasAnyInvolvement = requests.some(request => {
      // User is the requester
      if (request.requester_username === user?.username) {
        return true;
      }
      
      // User is involved as FROM or TO doctor in any shift
      if (user?.doctorCode) {
        return request.shifts.some(shift => 
          shift.from_doctor === user.doctorCode || 
          shift.to_doctor === user.doctorCode
        );
      }
      
      return false;
    });
    
    // Keep form open for new users, collapsed for users with any swap involvement
    setShowCreateForm(!userHasAnyInvolvement);
  }, [requests, user]);

  // Clear badges for regular users when viewing swap screen
  // Admins never clear badges (they clear when requests are handled)
  useFocusEffect(
    useCallback(() => {
      if (user && !isAdmin) {
        // Regular users: mark all as seen when viewing the screen
        const timer = setTimeout(() => {
          markAllRequestsAsSeen();
          // Update badge to reflect seen status
          fetchAndUpdateBadges(user.username, user.role, user.doctorCode)
        }, 100);
        
        return () => clearTimeout(timer);
      }
    }, [user?.username, user?.role, isAdmin])
  );

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Refresh data when screen gains focus
      if (user && !loading && !refreshing) {
        loadRequests(true);
        fetchAndUpdateBadges(user.username, user.role, user.doctorCode)
      }
    }, [user?.username, user?.role])
  );

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
      await loadRequests();
      
      // Refresh badges after creating a request
      if (user) {
        fetchAndUpdateBadges(user.username, user.role, user.doctorCode)
      }
      
      // Don't auto-close the form after submission
      // Let the useEffect handle it based on whether user now has swaps
    } catch (error) {
      throw error; // Let the form component handle the error
    }
  };

  const handleAcknowledge = async (requestId: number) => {
    try {
      await api.acknowledgeShiftChangeRequest(requestId);
      await loadRequests(); // Request will disappear
      
      // Refresh badges
      if (user) {
        fetchAndUpdateBadges(user.username, user.role, user.doctorCode)
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to dismiss request');
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
              await loadRequests();
              
              // Refresh badges to update admin count
              if (user) {
                fetchAndUpdateBadges(user.username, user.role, user.doctorCode)
              }
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
              await loadRequests();
              
              // Refresh badges to update admin count
              if (user) {
                fetchAndUpdateBadges(user.username, user.role, user.doctorCode)
              }
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
        // Show user's own requests and swaps involving them
        return (
          // They created the request
          request.requester_username === user?.username ||
          // They're involved in the swap (as from_doctor or to_doctor)
          request.shifts.some(shift => 
            shift.to_doctor === user?.doctorCode || 
            shift.from_doctor === user?.doctorCode ||
            // Fallback to old checks for compatibility
            shift.to_doctor === user?.fullName || 
            shift.to_doctor === user?.username
          )
        );
      } else {
        // Admin view - show all requests (they're already filtered to pending on backend)
        return true;
      }
    });

  const renderRequest = (request: ShiftChangeRequest) => {
    const isPending = request.status === 'pending';
    const canApprove = isAdmin && isPending && viewMode === 'admin';
    const canDismiss = !isPending && viewMode === 'mine'; // Can dismiss completed requests in My Swaps view

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

        {canDismiss && (
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => handleAcknowledge(request.id)}
          >
            <Text style={styles.dismissButtonText}>Dismiss</Text>
          </TouchableOpacity>
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
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRequests(true)}
            tintColor="#007AFF"
          />
        }
      >
        {viewMode === 'mine' && (
          <View style={styles.inlineFormContainer}>
            <View style={styles.inlineFormInner}>
              <TouchableOpacity 
                style={styles.formToggle}
                onPress={() => setShowCreateForm(!showCreateForm)}
              >
                <Text style={styles.formToggleText}>New Swap Request</Text>
                <Ionicons 
                  name={showCreateForm ? "chevron-up" : "chevron-down"} 
                  size={24} 
                  color="#007AFF" 
                />
              </TouchableOpacity>
              
              {showCreateForm && (
                <SwapRequestForm
                  onSubmit={handleCreateSwap}
                  doctors={doctors}
                  currentUser={user}
                />
              )}
            </View>
          </View>
        )}

        {/* Existing requests */}
        {filteredRequests.length === 0 && viewMode === 'admin' && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No pending swap requests to review
            </Text>
          </View>
        )}
        
        {filteredRequests.length > 0 && (
          <View style={styles.requestsSection}>
            <Text style={styles.sectionTitle}>
              {viewMode === 'mine' ? 'Your Requests' : 'Pending Requests'}
            </Text>
            {filteredRequests.map(renderRequest)}
          </View>
        )}
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  inlineFormContainer: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inlineFormInner: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  formToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  formToggleText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  requestsSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginHorizontal: 16,
    marginBottom: 8,
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
  dismissButton: {
    backgroundColor: '#F2F2F7',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
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