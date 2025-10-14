import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { MotiView } from 'moti';
import { Audio } from 'expo-av';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Photo {
  id?: string;
  url: string;
  is_primary: boolean;
  display_order: number;
  is_new?: boolean;
  to_delete?: boolean;
}

interface PromptAnswer {
  prompt: string;
  answer: string;
}

const PROMPT_OPTIONS = [
  "My ideal lavender marriage looks like...",
  "I'm looking for someone who...",
  "The best partnership includes...",
  "A perfect Sunday with my partner would be...",
  "Together we could...",
  "I need a partner who understands...",
  "My ideal living situation is...",
  "Financial goals I want us to share...",
  "The most important thing in our arrangement...",
  "I can offer my partner...",
  "Deal breakers for me are...",
  "My vision for our future includes...",
  "What makes me a great partner is...",
  "I'm passionate about...",
  "Green flags I'm looking for...",
  "A fun fact about me...",
  "My love language is...",
  "I'm secretly really good at...",
  "The key to my heart is...",
  "My guilty pleasure is...",
];

export default function EditProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [profileId, setProfileId] = useState<string>('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [occupation, setOccupation] = useState('');
  const [education, setEducation] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [gender, setGender] = useState('');
  const [sexualOrientation, setSexualOrientation] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [promptAnswers, setPromptAnswers] = useState<PromptAnswer[]>([
    { prompt: '', answer: '' },
    { prompt: '', answer: '' },
    { prompt: '', answer: '' },
  ]);
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState('');
  const [voiceIntroUrl, setVoiceIntroUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          age,
          bio,
          occupation,
          education,
          location_city,
          location_state,
          gender,
          sexual_orientation,
          prompt_answers,
          interests,
          voice_intro_url,
          voice_intro_duration,
          photos (
            id,
            url,
            is_primary,
            display_order
          )
        `)
        .eq('user_id', user?.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      if (profileData) {
        setProfileId(profileData.id);
        setDisplayName(profileData.display_name || '');
        setAge(profileData.age?.toString() || '');
        setBio(profileData.bio || '');
        setOccupation(profileData.occupation || '');
        setEducation(profileData.education || '');
        setLocationCity(profileData.location_city || '');
        setLocationState(profileData.location_state || '');
        setGender(profileData.gender || '');
        setSexualOrientation(profileData.sexual_orientation || '');

        if (profileData.photos) {
          setPhotos(profileData.photos.sort((a: Photo, b: Photo) =>
            a.display_order - b.display_order
          ));
        }

        if (profileData.prompt_answers && profileData.prompt_answers.length > 0) {
          setPromptAnswers([
            ...profileData.prompt_answers,
            ...Array(3 - profileData.prompt_answers.length).fill({ prompt: '', answer: '' })
          ].slice(0, 3));
        }

        if (profileData.interests) {
          setInterests(profileData.interests);
        }

        if (profileData.voice_intro_url) {
          setVoiceIntroUrl(profileData.voice_intro_url);
        }
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    if (photos.length >= 6) {
      Alert.alert('Limit Reached', 'You can add up to 6 photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newPhoto: Photo = {
        url: result.assets[0].uri,
        is_primary: photos.length === 0,
        display_order: photos.length,
        is_new: true,
      };
      setPhotos([...photos, newPhoto]);
    }
  };

  const removePhoto = (index: number) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    // Update display order
    updatedPhotos.forEach((photo, i) => {
      photo.display_order = i;
      if (i === 0) photo.is_primary = true;
    });
    setPhotos(updatedPhotos);
  };

  const movePhoto = (index: number, direction: 'up' | 'down') => {
    const newPhotos = [...photos];
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex >= 0 && newIndex < photos.length) {
      [newPhotos[index], newPhotos[newIndex]] = [newPhotos[newIndex], newPhotos[index]];

      // Update display order and primary status
      newPhotos.forEach((photo, i) => {
        photo.display_order = i;
        photo.is_primary = i === 0;
      });

      setPhotos(newPhotos);
    }
  };

  const updatePromptAnswer = (index: number, field: 'prompt' | 'answer', value: string) => {
    const updated = [...promptAnswers];
    updated[index] = { ...updated[index], [field]: value };
    setPromptAnswers(updated);
  };

  const addInterest = () => {
    if (newInterest.trim() && interests.length < 10) {
      setInterests([...interests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  const removeInterest = (index: number) => {
    setInterests(interests.filter((_, i) => i !== index));
  };

  const startVoiceRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone access is needed');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopVoiceRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setVoiceIntroUrl(uri);
      setRecording(null);
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const saveProfile = async () => {
    if (!displayName || !age) {
      Alert.alert('Required Fields', 'Please fill in your name and age');
      return;
    }

    setSaving(true);

    try {
      // Filter out empty prompt answers
      const validPromptAnswers = promptAnswers.filter(pa => pa.prompt && pa.answer);

      // Update or create profile
      const profilePayload = {
        user_id: user?.id,
        display_name: displayName,
        age: parseInt(age),
        bio,
        occupation,
        education,
        location_city: locationCity,
        location_state: locationState,
        gender,
        sexual_orientation: sexualOrientation,
        prompt_answers: validPromptAnswers.length > 0 ? validPromptAnswers : null,
        interests: interests.length > 0 ? interests : null,
        voice_intro_url: voiceIntroUrl,
        is_active: true,
      };

      let finalProfileId = profileId;

      if (profileId) {
        // Update existing profile
        const { error } = await supabase
          .from('profiles')
          .update(profilePayload)
          .eq('id', profileId);

        if (error) throw error;
      } else {
        // Create new profile
        const { data, error } = await supabase
          .from('profiles')
          .insert(profilePayload)
          .select()
          .single();

        if (error) throw error;
        finalProfileId = data.id;
        setProfileId(data.id);
      }

      // Handle photo updates
      for (const photo of photos) {
        if (photo.is_new) {
          // Upload new photo (in a real app, you'd upload to storage first)
          // For now, we'll use the local URI as a placeholder
          const { error } = await supabase
            .from('photos')
            .insert({
              profile_id: finalProfileId,
              url: photo.url,
              is_primary: photo.is_primary,
              display_order: photo.display_order,
              is_public: true,
            });

          if (error) console.error('Error adding photo:', error);
        } else if (photo.id) {
          // Update existing photo order
          const { error } = await supabase
            .from('photos')
            .update({
              is_primary: photo.is_primary,
              display_order: photo.display_order,
            })
            .eq('id', photo.id);

          if (error) console.error('Error updating photo:', error);
        }
      }

      Alert.alert(
        'Success',
        'Your profile has been updated!',
        [
          { text: 'View Profile', onPress: () => router.back() }
        ]
      );
    } catch (error: any) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', error.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#8B5CF6', '#EC4899']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={saveProfile} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.saveButton}>Save</Text>
          )}
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Photos Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <Text style={styles.sectionSubtitle}>Add up to 6 photos. First photo will be your primary.</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
            {photos.map((photo, index) => (
              <MotiView
                key={index}
                from={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring' }}
                style={styles.photoContainer}
              >
                <Image source={{ uri: photo.url }} style={styles.photoImage} />

                {/* Photo Controls */}
                <View style={styles.photoControls}>
                  {index > 0 && (
                    <TouchableOpacity
                      style={styles.photoControl}
                      onPress={() => movePhoto(index, 'up')}
                    >
                      <MaterialCommunityIcons name="arrow-left" size={16} color="white" />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.photoControl, styles.deleteControl]}
                    onPress={() => removePhoto(index)}
                  >
                    <MaterialCommunityIcons name="close" size={16} color="white" />
                  </TouchableOpacity>

                  {index < photos.length - 1 && (
                    <TouchableOpacity
                      style={styles.photoControl}
                      onPress={() => movePhoto(index, 'down')}
                    >
                      <MaterialCommunityIcons name="arrow-right" size={16} color="white" />
                    </TouchableOpacity>
                  )}
                </View>

                {photo.is_primary && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryText}>Primary</Text>
                  </View>
                )}
              </MotiView>
            ))}

            {photos.length < 6 && (
              <TouchableOpacity style={styles.addPhotoButton} onPress={pickImage}>
                <MaterialCommunityIcons name="camera-plus" size={32} color="#8B5CF6" />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* Basic Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Display Name *</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Age *</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              placeholder="Your age"
              keyboardType="numeric"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Gender</Text>
            <TextInput
              style={styles.input}
              value={gender}
              onChangeText={setGender}
              placeholder="Your gender identity"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Sexual Orientation</Text>
            <TextInput
              style={styles.input}
              value={sexualOrientation}
              onChangeText={setSexualOrientation}
              placeholder="Your sexual orientation"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About You</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell your story..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Occupation</Text>
            <TextInput
              style={styles.input}
              value={occupation}
              onChangeText={setOccupation}
              placeholder="What do you do?"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Education</Text>
            <TextInput
              style={styles.input}
              value={education}
              onChangeText={setEducation}
              placeholder="Your education"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>City</Text>
            <TextInput
              style={styles.input}
              value={locationCity}
              onChangeText={setLocationCity}
              placeholder="City"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>State</Text>
            <TextInput
              style={styles.input}
              value={locationState}
              onChangeText={setLocationState}
              placeholder="State"
              placeholderTextColor="#9CA3AF"
              maxLength={2}
              autoCapitalize="characters"
            />
          </View>
        </View>

        {/* Interests Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests & Hobbies</Text>
          <Text style={styles.sectionSubtitle}>Add up to 10 interests</Text>

          <View style={styles.interestsContainer}>
            {interests.map((interest, index) => (
              <TouchableOpacity
                key={index}
                style={styles.interestChip}
                onPress={() => removeInterest(index)}
              >
                <Text style={styles.interestText}>{interest}</Text>
                <MaterialCommunityIcons name="close" size={16} color="#8B5CF6" />
              </TouchableOpacity>
            ))}
          </View>

          {interests.length < 10 && (
            <View style={styles.addInterestContainer}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newInterest}
                onChangeText={setNewInterest}
                placeholder="Add an interest..."
                placeholderTextColor="#9CA3AF"
                onSubmitEditing={addInterest}
              />
              <TouchableOpacity style={styles.addButton} onPress={addInterest}>
                <MaterialCommunityIcons name="plus" size={24} color="#8B5CF6" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Voice Introduction Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice Introduction</Text>
          <Text style={styles.sectionSubtitle}>Record a 30-second voice intro</Text>

          <TouchableOpacity
            style={[styles.voiceButton, isRecording && styles.voiceButtonRecording]}
            onPress={isRecording ? stopVoiceRecording : startVoiceRecording}
          >
            <MaterialCommunityIcons
              name={isRecording ? "stop" : "microphone"}
              size={32}
              color={isRecording ? "#EF4444" : "#8B5CF6"}
            />
            <Text style={[styles.voiceButtonText, isRecording && { color: '#EF4444' }]}>
              {isRecording ? "Stop Recording" : voiceIntroUrl ? "Re-record Voice Intro" : "Record Voice Intro"}
            </Text>
          </TouchableOpacity>

          {voiceIntroUrl && !isRecording && (
            <View style={styles.voiceStatus}>
              <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
              <Text style={styles.voiceStatusText}>Voice intro recorded</Text>
            </View>
          )}
        </View>

        {/* Prompt Answers Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prompt Answers</Text>
          <Text style={styles.sectionSubtitle}>Answer prompts to help others get to know you better</Text>

          {promptAnswers.map((pa, index) => (
            <View key={index} style={styles.promptContainer}>
              <TouchableOpacity
                style={styles.promptSelector}
                onPress={() => {
                  Alert.alert(
                    'Select a Prompt',
                    '',
                    PROMPT_OPTIONS.map(prompt => ({
                      text: prompt,
                      onPress: () => updatePromptAnswer(index, 'prompt', prompt)
                    }))
                  );
                }}
              >
                <Text style={pa.prompt ? styles.promptText : styles.promptPlaceholder}>
                  {pa.prompt || 'Select a prompt...'}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#8B5CF6" />
              </TouchableOpacity>

              {pa.prompt && (
                <TextInput
                  style={[styles.input, styles.promptAnswer]}
                  value={pa.answer}
                  onChangeText={(text) => updatePromptAnswer(index, 'answer', text)}
                  placeholder="Your answer..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              )}
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {/* Save & Preview Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.savePreviewButton]}
            onPress={async () => {
              // Save first, then preview
              await saveProfile();
              router.push('/profile/preview');
            }}
            disabled={saving}
          >
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              style={styles.actionButtonGradient}
            >
              <MaterialCommunityIcons name="content-save" size={20} color="white" />
              <Text style={styles.actionButtonText}>Save & View</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Live Preview Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.previewButton]}
            onPress={() => {
            // Pass current form data to preview
            const previewData = {
              display_name: displayName,
              age,
              bio,
              occupation,
              education,
              location_city: locationCity,
              location_state: locationState,
              gender,
              sexual_orientation: sexualOrientation,
              photos,
              prompt_answers: promptAnswers.filter(pa => pa.prompt && pa.answer),
              interests,
              voice_intro_url: voiceIntroUrl,
              is_verified: false,
            };

            // Store in temporary storage for preview
            router.push({
              pathname: '/profile/preview',
              params: {
                profileData: JSON.stringify(previewData),
                isRealtime: 'true'
              }
            });
          }}
        >
              <MaterialCommunityIcons name="eye" size={20} color="#8B5CF6" />
              <Text style={styles.previewButtonText}>Live Preview</Text>
            </TouchableOpacity>
          </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: 'white',
    marginTop: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  photosScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  photoContainer: {
    marginRight: 12,
    position: 'relative',
  },
  photoImage: {
    width: 120,
    height: 160,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  photoControls: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  photoControl: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteControl: {
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
  },
  primaryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  primaryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  addPhotoButton: {
    width: 120,
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  addPhotoText: {
    fontSize: 14,
    color: '#8B5CF6',
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  promptContainer: {
    marginBottom: 20,
  },
  promptSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  promptText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
  },
  promptPlaceholder: {
    fontSize: 15,
    color: '#9CA3AF',
    flex: 1,
  },
  promptAnswer: {
    minHeight: 80,
    paddingTop: 12,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  interestText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  addInterestContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#F3E8FF',
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E9D5FF',
  },
  voiceButtonRecording: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  voiceButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  voiceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  voiceStatusText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  savePreviewButton: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#8B5CF6',
    backgroundColor: 'white',
  },
  previewButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8B5CF6',
  },
});