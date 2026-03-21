/**
 * "My Ideal Lavender Marriage" card — replaces the interests/hobbies section
 * on profile cards. Shows intention, children/family plans, housing, and
 * financial arrangement in a cohesive visual section.
 */

import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface IdealMarriageCardProps {
  /** Primary reasons / intentions (string[]) */
  primaryReasons?: string[] | null;
  /** Wants children: true/false/null */
  wantsChildren?: boolean | null;
  /** Children arrangement (string[]) */
  childrenArrangement?: string[] | null;
  /** Housing preference (string[]) */
  housingPreference?: string[] | null;
  /** Financial arrangement (string[]) */
  financialArrangement?: string[] | null;
  /** Relationship type */
  relationshipType?: string | null;
}

// Label mappings (value → display)
const REASON_LABELS: Record<string, string> = {
  financial: 'Financial Stability',
  immigration: 'Immigration/Visa',
  family_pressure: 'Family Pressure',
  legal_benefits: 'Legal Benefits',
  companionship: 'Companionship',
  safety: 'Safety & Protection',
  other: 'Other',
};

const HOUSING_LABELS: Record<string, string> = {
  separate_spaces: 'Separate Spaces',
  roommates: 'Live Like Roommates',
  separate_homes: 'Separate Homes',
  shared_bedroom: 'Shared Bedroom',
  flexible: 'Flexible',
};

const FINANCIAL_LABELS: Record<string, string> = {
  separate: 'Separate Finances',
  shared_expenses: 'Shared Expenses',
  joint: 'Joint Finances',
  prenup_required: 'Prenup Required',
  flexible: 'Flexible',
};

const CHILDREN_LABELS: Record<string, string> = {
  biological: 'Biological',
  adoption: 'Adoption',
  surrogacy: 'Surrogacy',
  ivf: 'IVF',
  co_parenting: 'Co-Parenting',
  fostering: 'Fostering',
  already_have: 'Already Have Kids',
  open_discussion: 'Open to Discussion',
  other: 'Other',
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  platonic: 'Platonic',
  romantic: 'Romantic',
  open: 'Open',
};

interface RowProps {
  icon: string;
  label: string;
  values: string[];
  isDark: boolean;
}

function InfoRow({ icon, label, values, isDark }: RowProps) {
  if (values.length === 0) return null;
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon as any} size={20} color="#A08AB7" style={styles.rowIcon} />
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: isDark ? '#E5E7EB' : '#1F2937' }]} numberOfLines={2}>
          {values.join(' · ')}
        </Text>
      </View>
    </View>
  );
}

export default function IdealMarriageCard({
  primaryReasons,
  wantsChildren,
  childrenArrangement,
  housingPreference,
  financialArrangement,
  relationshipType,
}: IdealMarriageCardProps) {
  const isDark = useColorScheme() === 'dark';

  // Build display values
  const intentionValues = (primaryReasons || []).map((r) => REASON_LABELS[r] || r);
  const childrenDisplay: string[] = [];
  if (wantsChildren === true) childrenDisplay.push('Wants children');
  else if (wantsChildren === false) childrenDisplay.push('No children');
  if (childrenArrangement?.length) {
    childrenDisplay.push(...childrenArrangement.map((c) => CHILDREN_LABELS[c] || c));
  }
  const housingValues = (housingPreference || []).map((h) => HOUSING_LABELS[h] || h);
  const financialValues = (financialArrangement || []).map((f) => FINANCIAL_LABELS[f] || f);
  const relationshipValues = relationshipType ? [RELATIONSHIP_LABELS[relationshipType] || relationshipType] : [];

  // Don't render if no data
  const hasAny = intentionValues.length > 0 || childrenDisplay.length > 0 || housingValues.length > 0 || financialValues.length > 0;
  if (!hasAny) return null;

  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA', borderColor: isDark ? '#2C2C3E' : '#E8E3F0' }]}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="heart-half-full" size={22} color="#A08AB7" />
        <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#1F2937' }]}>
          My Ideal Lavender Marriage
        </Text>
      </View>

      {relationshipValues.length > 0 && (
        <InfoRow icon="handshake-outline" label="Relationship" values={relationshipValues} isDark={isDark} />
      )}
      <InfoRow icon="compass-outline" label="Intention" values={intentionValues} isDark={isDark} />
      <InfoRow icon="baby-carriage" label="Children" values={childrenDisplay} isDark={isDark} />
      <InfoRow icon="home-outline" label="Housing" values={housingValues} isDark={isDark} />
      <InfoRow icon="cash-multiple" label="Finances" values={financialValues} isDark={isDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  rowIcon: {
    marginTop: 2,
    marginRight: 12,
    width: 20,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
});
