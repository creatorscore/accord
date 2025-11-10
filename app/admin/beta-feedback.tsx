import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Feedback {
  id: string;
  profile_id: string;
  feedback_type: string;
  subject: string;
  description: string;
  rating_overall: number | null;
  rating_ease_of_use: number | null;
  rating_matching_quality: number | null;
  rating_performance: number | null;
  rating_design: number | null;
  status: string;
  priority: string;
  user_email: string | null;
  device_info: any;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  admin_notes: string | null;
  created_at: string;
  profiles: { display_name: string };
}

export default function BetaFeedbackAdmin() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [filteredFeedback, setFilteredFeedback] = useState<Feedback[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAndLoadFeedback();
  }, []);

  useEffect(() => {
    filterFeedback();
  }, [feedback, selectedType, selectedStatus, searchQuery]);

  const checkAdminAndLoadFeedback = async () => {
    try {
      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', user?.id)
        .single();

      if (!profile?.is_admin) {
        router.back();
        return;
      }

      await loadFeedback();
    } catch (error) {
      console.error('Error checking admin status:', error);
      router.back();
    }
  };

  const loadFeedback = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('beta_feedback')
        .select('*, profiles!inner(display_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFeedback(data || []);
    } catch (error) {
      console.error('Error loading feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterFeedback = () => {
    let filtered = [...feedback];

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter((f) => f.feedback_type === selectedType);
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter((f) => f.status === selectedStatus);
    }

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.subject.toLowerCase().includes(query) ||
          f.description.toLowerCase().includes(query) ||
          f.profiles.display_name.toLowerCase().includes(query)
      );
    }

    setFilteredFeedback(filtered);
  };

  const updateFeedbackStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('beta_feedback')
        .update({
          status,
          resolved_at: status === 'completed' ? new Date().toISOString() : null,
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setFeedback((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, status, resolved_at: status === 'completed' ? new Date().toISOString() : null }
            : f
        )
      );

      Alert.alert('Success', 'Feedback status updated');
    } catch (error) {
      console.error('Error updating feedback:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const updatePriority = async (id: string, priority: string) => {
    try {
      const { error } = await supabase
        .from('beta_feedback')
        .update({ priority })
        .eq('id', id);

      if (error) throw error;

      setFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, priority } : f)));
      Alert.alert('Success', 'Priority updated');
    } catch (error) {
      console.error('Error updating priority:', error);
      Alert.alert('Error', 'Failed to update priority');
    }
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return <Text style={styles.noRating}>N/A</Text>;

    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={16}
            color={star <= rating ? '#F59E0B' : '#D1D5DB'}
          />
        ))}
      </View>
    );
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'bug_report':
        return '#EF4444';
      case 'feature_request':
        return '#3B82F6';
      case 'usability_issue':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return '#10B981';
      case 'reviewing':
        return '#3B82F6';
      case 'planned':
        return '#8B5CF6';
      case 'in_progress':
        return '#F59E0B';
      case 'completed':
        return '#6B7280';
      case 'wont_fix':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return '#DC2626';
      case 'high':
        return '#F59E0B';
      case 'medium':
        return '#3B82F6';
      case 'low':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9B87CE" />
        <Text style={styles.loadingText}>Loading feedback...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Beta Feedback ({filteredFeedback.length})</Text>
        <TouchableOpacity onPress={loadFeedback} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#9B87CE" />
        </TouchableOpacity>
      </View>

      {/* Search & Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search feedback..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, selectedType === 'all' && styles.filterChipActive]}
            onPress={() => setSelectedType('all')}
          >
            <Text style={[styles.filterText, selectedType === 'all' && styles.filterTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedType === 'bug_report' && styles.filterChipActive]}
            onPress={() => setSelectedType('bug_report')}
          >
            <Text
              style={[styles.filterText, selectedType === 'bug_report' && styles.filterTextActive]}
            >
              Bugs
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedType === 'feature_request' && styles.filterChipActive,
            ]}
            onPress={() => setSelectedType('feature_request')}
          >
            <Text
              style={[
                styles.filterText,
                selectedType === 'feature_request' && styles.filterTextActive,
              ]}
            >
              Features
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedType === 'usability_issue' && styles.filterChipActive,
            ]}
            onPress={() => setSelectedType('usability_issue')}
          >
            <Text
              style={[
                styles.filterText,
                selectedType === 'usability_issue' && styles.filterTextActive,
              ]}
            >
              Usability
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Feedback List */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {filteredFeedback.map((item) => (
          <View key={item.id} style={styles.feedbackCard}>
            <TouchableOpacity onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}>
              <View style={styles.feedbackHeader}>
                <View style={styles.feedbackHeaderLeft}>
                  <View
                    style={[styles.typeBadge, { backgroundColor: `${getTypeColor(item.feedback_type)}20` }]}
                  >
                    <Text style={[styles.typeBadgeText, { color: getTypeColor(item.feedback_type) }]}>
                      {item.feedback_type.replace('_', ' ')}
                    </Text>
                  </View>
                  <View
                    style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}
                  >
                    <Text style={[styles.statusBadgeText, { color: getStatusColor(item.status) }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={expandedId === item.id ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#6B7280"
                />
              </View>

              <Text style={styles.feedbackSubject}>{item.subject}</Text>
              <Text style={styles.feedbackDescription} numberOfLines={2}>
                {item.description}
              </Text>

              <View style={styles.feedbackMeta}>
                <Text style={styles.metaText}>
                  <Ionicons name="person" size={12} color="#9CA3AF" /> {item.profiles.display_name}
                </Text>
                <Text style={styles.metaText}>
                  <Ionicons name="time" size={12} color="#9CA3AF" />{' '}
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Expanded Details */}
            {expandedId === item.id && (
              <View style={styles.expandedDetails}>
                {/* Ratings */}
                {item.rating_overall && (
                  <View style={styles.ratingsSection}>
                    <Text style={styles.detailLabel}>Ratings:</Text>
                    <View style={styles.ratingRow}>
                      <Text style={styles.ratingLabel}>Overall:</Text>
                      {renderStars(item.rating_overall)}
                    </View>
                    {item.rating_ease_of_use && (
                      <View style={styles.ratingRow}>
                        <Text style={styles.ratingLabel}>Ease of Use:</Text>
                        {renderStars(item.rating_ease_of_use)}
                      </View>
                    )}
                    {item.rating_matching_quality && (
                      <View style={styles.ratingRow}>
                        <Text style={styles.ratingLabel}>Match Quality:</Text>
                        {renderStars(item.rating_matching_quality)}
                      </View>
                    )}
                  </View>
                )}

                {/* Bug Details */}
                {item.steps_to_reproduce && (
                  <View style={styles.bugDetails}>
                    <Text style={styles.detailLabel}>Steps to Reproduce:</Text>
                    <Text style={styles.detailText}>{item.steps_to_reproduce}</Text>
                  </View>
                )}

                {/* Device Info */}
                {item.device_info && (
                  <View style={styles.deviceInfo}>
                    <Text style={styles.detailLabel}>Device:</Text>
                    <Text style={styles.detailText}>
                      {item.device_info.platform} {item.device_info.os_version} - v
                      {item.device_info.app_version}
                    </Text>
                  </View>
                )}

                {/* Contact Info */}
                {item.user_email && (
                  <View style={styles.contactInfo}>
                    <Text style={styles.detailLabel}>Contact:</Text>
                    <Text style={styles.detailText}>{item.user_email}</Text>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <Text style={styles.actionsLabel}>Status:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['new', 'reviewing', 'planned', 'in_progress', 'completed', 'wont_fix'].map(
                      (status) => (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.actionChip,
                            item.status === status && styles.actionChipActive,
                          ]}
                          onPress={() => updateFeedbackStatus(item.id, status)}
                        >
                          <Text
                            style={[
                              styles.actionChipText,
                              item.status === status && styles.actionChipTextActive,
                            ]}
                          >
                            {status.replace('_', ' ')}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </ScrollView>
                </View>

                <View style={styles.actionsRow}>
                  <Text style={styles.actionsLabel}>Priority:</Text>
                  <View style={styles.priorityRow}>
                    {['low', 'medium', 'high', 'critical'].map((priority) => (
                      <TouchableOpacity
                        key={priority}
                        style={[
                          styles.actionChip,
                          item.priority === priority && styles.actionChipActive,
                        ]}
                        onPress={() => updatePriority(item.id, priority)}
                      >
                        <Text
                          style={[
                            styles.actionChipText,
                            item.priority === priority && styles.actionChipTextActive,
                          ]}
                        >
                          {priority}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>
        ))}

        {filteredFeedback.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No feedback found</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  refreshButton: {
    padding: 8,
  },
  filtersContainer: {
    backgroundColor: 'white',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#1F2937',
  },
  filterRow: {
    paddingHorizontal: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#9B87CE',
  },
  filterText: {
    fontSize: 14,
    color: '#6B7280',
  },
  filterTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  feedbackCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedbackHeaderLeft: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  feedbackSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  feedbackDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  feedbackMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  expandedDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  ratingsSection: {
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingLabel: {
    fontSize: 13,
    color: '#6B7280',
    width: 100,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  noRating: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  bugDetails: {},
  deviceInfo: {},
  contactInfo: {},
  detailText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  actionsRow: {
    marginTop: 8,
  },
  actionsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  actionChipActive: {
    backgroundColor: '#9B87CE',
  },
  actionChipText: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  actionChipTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
  },
});
