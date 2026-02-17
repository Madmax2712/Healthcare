// ============================================================
// HealthGuard Mobile - Profile Screen
// ============================================================
// User profile management with medical info, emergency contacts,
// and account actions. Supports edit mode and swipe-to-delete
// for contacts.
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  touchTargets,
  layout,
} from '../../theme';
import type { EmergencyContact } from '../../../shared/types';

// ── Add Contact Modal Content ─────────────────────────────────

interface AddContactFormProps {
  onSave: (data: {
    contact_name: string;
    phone_number: string;
    relationship?: string;
    is_primary: boolean;
  }) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const AddContactForm: React.FC<AddContactFormProps> = ({
  onSave,
  onCancel,
  isLoading,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a contact name.');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      Alert.alert('Required', 'Please enter a valid phone number.');
      return;
    }
    onSave({
      contact_name: name.trim(),
      phone_number: `+1${phone.replace(/\D/g, '').slice(0, 10)}`,
      relationship: relationship.trim() || undefined,
      is_primary: false,
    });
  };

  return (
    <Card style={styles.addContactCard} variant="elevated" padding="large">
      <Text style={styles.addContactTitle}>Add Emergency Contact</Text>

      <Text style={styles.fieldLabel}>Name</Text>
      <TextInput
        style={styles.fieldInput}
        value={name}
        onChangeText={setName}
        placeholder="Contact name"
        placeholderTextColor={colors.placeholder}
        autoFocus
        accessibilityLabel="Contact name"
      />

      <Text style={styles.fieldLabel}>Phone Number</Text>
      <TextInput
        style={styles.fieldInput}
        value={phone}
        onChangeText={setPhone}
        placeholder="(555) 123-4567"
        placeholderTextColor={colors.placeholder}
        keyboardType="phone-pad"
        accessibilityLabel="Contact phone number"
      />

      <Text style={styles.fieldLabel}>Relationship (optional)</Text>
      <TextInput
        style={styles.fieldInput}
        value={relationship}
        onChangeText={setRelationship}
        placeholder="e.g., Spouse, Son, Daughter"
        placeholderTextColor={colors.placeholder}
        accessibilityLabel="Relationship"
      />

      <View style={styles.addContactActions}>
        <Button
          title="Cancel"
          onPress={onCancel}
          variant="outline"
          style={styles.addContactButton}
        />
        <Button
          title="Save Contact"
          onPress={handleSave}
          variant="primary"
          loading={isLoading}
          style={styles.addContactButton}
          icon="check"
        />
      </View>
    </Card>
  );
};

// ── Contact Item Sub-Component ────────────────────────────────

interface ContactItemProps {
  contact: EmergencyContact;
  onDelete: () => void;
}

const ContactItem: React.FC<ContactItemProps> = ({ contact, onDelete }) => {
  const handleDelete = () => {
    Alert.alert(
      'Remove Contact',
      `Remove ${contact.contact_name} from your emergency contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: onDelete,
        },
      ],
    );
  };

  return (
    <View style={styles.contactItem}>
      <View style={styles.contactAvatar}>
        <Text style={styles.contactAvatarText}>
          {contact.contact_name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{contact.contact_name}</Text>
        <Text style={styles.contactPhone}>{contact.phone_number}</Text>
        {contact.relationship && (
          <Text style={styles.contactRelationship}>{contact.relationship}</Text>
        )}
      </View>
      {contact.is_primary && (
        <View style={styles.primaryBadge}>
          <Text style={styles.primaryBadgeText}>Primary</Text>
        </View>
      )}
      <TouchableOpacity
        onPress={handleDelete}
        style={styles.deleteButton}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${contact.contact_name}`}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Icon name="trash-can-outline" size={24} color={colors.danger} />
      </TouchableOpacity>
    </View>
  );
};

// ── Info Row Sub-Component ────────────────────────────────────

interface ProfileInfoRowProps {
  icon: string;
  label: string;
  value: string;
}

const ProfileInfoRow: React.FC<ProfileInfoRowProps> = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <Icon name={icon} size={24} color={colors.textTertiary} />
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

// ── Main Component ────────────────────────────────────────────

const ProfileScreen: React.FC = () => {
  const {
    user,
    emergencyContacts,
    isLoading,
    error,
    fetchEmergencyContacts,
    addEmergencyContact,
    removeEmergencyContact,
    updateProfile,
    logout,
    clearError,
  } = useAuthStore();

  const [showAddContact, setShowAddContact] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  useEffect(() => {
    fetchEmergencyContacts();
  }, [fetchEmergencyContacts]);

  useEffect(() => {
    if (user) {
      setEditName(user.full_name || '');
      setEditEmail(user.email || '');
    }
  }, [user]);

  const handleAddContact = useCallback(
    async (data: {
      contact_name: string;
      phone_number: string;
      relationship?: string;
      is_primary: boolean;
    }) => {
      try {
        await addEmergencyContact(data);
        setShowAddContact(false);
      } catch {
        Alert.alert('Error', 'Failed to add contact. Please try again.');
      }
    },
    [addEmergencyContact],
  );

  const handleRemoveContact = useCallback(
    async (contactId: string) => {
      try {
        await removeEmergencyContact(contactId);
      } catch {
        Alert.alert('Error', 'Failed to remove contact. Please try again.');
      }
    },
    [removeEmergencyContact],
  );

  const handleSaveProfile = useCallback(async () => {
    try {
      await updateProfile({
        full_name: editName.trim(),
        email: editEmail.trim() || undefined,
      });
      setIsEditing(false);
      Alert.alert('Profile Updated', 'Your profile has been updated successfully.');
    } catch {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  }, [editName, editEmail, updateProfile]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of HealthGuard?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ],
    );
  }, [logout]);

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSpinner fullScreen message="Loading profile..." />
      </SafeAreaView>
    );
  }

  const initials = user.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        {!isEditing && (
          <TouchableOpacity
            onPress={() => setIsEditing(true)}
            style={styles.editButton}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Icon name="pencil" size={24} color={colors.primary} />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar and Name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          {isEditing ? (
            <View style={styles.editFieldsContainer}>
              <TextInput
                style={styles.editNameInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Full Name"
                placeholderTextColor={colors.placeholder}
                accessibilityLabel="Full name"
              />
              <TextInput
                style={styles.editEmailInput}
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="Email address"
                placeholderTextColor={colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                accessibilityLabel="Email address"
              />
              <View style={styles.editActions}>
                <Button
                  title="Cancel"
                  onPress={() => {
                    setIsEditing(false);
                    setEditName(user.full_name || '');
                    setEditEmail(user.email || '');
                  }}
                  variant="outline"
                  size="small"
                  style={styles.editActionButton}
                />
                <Button
                  title="Save"
                  onPress={handleSaveProfile}
                  variant="primary"
                  size="small"
                  loading={isLoading}
                  icon="check"
                  style={styles.editActionButton}
                />
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.userName}>{user.full_name}</Text>
              <Text style={styles.userPhone}>{user.phone_number}</Text>
              {user.email && (
                <Text style={styles.userEmail}>{user.email}</Text>
              )}
            </>
          )}
        </View>

        {/* Medical Info */}
        <Text style={styles.sectionTitle}>Medical Information</Text>
        <Card style={styles.medicalCard} variant="outlined">
          <ProfileInfoRow
            icon="water"
            label="Blood Type"
            value={user.blood_type || 'Not set'}
          />
          <ProfileInfoRow
            icon="alert-circle-outline"
            label="Allergies"
            value={
              user.allergies && user.allergies.length > 0
                ? user.allergies.join(', ')
                : 'None listed'
            }
          />
          <ProfileInfoRow
            icon="clipboard-pulse"
            label="Medical Conditions"
            value={
              user.medical_conditions && user.medical_conditions.length > 0
                ? user.medical_conditions.join(', ')
                : 'None listed'
            }
          />
        </Card>

        {/* Emergency Contacts */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Emergency Contacts</Text>
          <Text style={styles.contactCount}>
            {emergencyContacts.length} contact{emergencyContacts.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {showAddContact ? (
          <AddContactForm
            onSave={handleAddContact}
            onCancel={() => setShowAddContact(false)}
            isLoading={isLoading}
          />
        ) : (
          <Button
            title="Add Contact"
            onPress={() => setShowAddContact(true)}
            variant="outline"
            fullWidth
            icon="account-plus"
            style={styles.addContactButton2}
            accessibilityLabel="Add an emergency contact"
          />
        )}

        {emergencyContacts.length > 0 ? (
          <Card style={styles.contactsCard} variant="outlined">
            {emergencyContacts.map((contact) => (
              <ContactItem
                key={contact.contact_id}
                contact={contact}
                onDelete={() => handleRemoveContact(contact.contact_id)}
              />
            ))}
          </Card>
        ) : (
          <Card style={styles.emptyContactsCard} variant="outlined">
            <Icon name="account-group" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyContactsText}>
              No emergency contacts added yet
            </Text>
            <Text style={styles.emptyContactsSubtext}>
              Add contacts who should be notified in an emergency
            </Text>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={20} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={clearError}>
              <Icon name="close" size={20} color={colors.danger} />
            </TouchableOpacity>
          </View>
        )}

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <Button
            title="Log Out"
            onPress={handleLogout}
            variant="danger"
            fullWidth
            icon="logout"
            size="large"
            accessibilityLabel="Log out of HealthGuard"
          />
        </View>

        {/* App Version */}
        <Text style={styles.versionText}>HealthGuard v1.0.0</Text>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.base,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: {
    ...typography.heading2,
    color: colors.primary,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
  },
  editButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
  },

  // Avatar Section
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
    marginBottom: spacing.lg,
  },
  avatarText: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  userName: {
    ...typography.heading2,
    textAlign: 'center',
  },
  userPhone: {
    fontSize: typography.fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  userEmail: {
    fontSize: typography.fontSize.base,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },

  // Edit Mode
  editFieldsContainer: {
    width: '100%',
    paddingHorizontal: spacing.lg,
  },
  editNameInput: {
    height: layout.inputHeight,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  editEmailInput: {
    height: layout.inputHeight,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  editActionButton: {
    minWidth: 120,
  },

  // Medical Info
  sectionTitle: {
    ...typography.heading3,
    marginBottom: spacing.base,
  },
  medicalCard: {
    marginBottom: spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  infoLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
    lineHeight: 24,
  },

  // Emergency Contacts Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.base,
  },
  contactCount: {
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  addContactButton2: {
    marginBottom: spacing.base,
  },

  // Add Contact Form
  addContactCard: {
    marginBottom: spacing.base,
  },
  addContactTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  fieldInput: {
    height: layout.inputHeight,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  addContactActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  addContactButton: {
    minWidth: 120,
  },

  // Contact List
  contactsCard: {
    marginBottom: spacing.xl,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  contactAvatarText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  contactPhone: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginTop: 2,
  },
  contactRelationship: {
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    marginTop: 2,
  },
  primaryBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  primaryBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success,
  },
  deleteButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContactsCard: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    marginBottom: spacing.xl,
  },
  emptyContactsText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptyContactsSubtext: {
    fontSize: typography.fontSize.base,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // Error
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    padding: spacing.base,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.danger,
    marginHorizontal: spacing.sm,
  },

  // Logout
  logoutSection: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },

  // Version
  versionText: {
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});

export default ProfileScreen;
