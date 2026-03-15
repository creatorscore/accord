export interface HobbyOption {
  icon: string; // MaterialCommunityIcons name
  label: string; // Display text
  value: string; // DB-stored value (= label, no emoji)
}

export const HOBBY_OPTIONS: HobbyOption[] = [
  { icon: 'palette', label: 'Art & Design', value: 'Art & Design' },
  { icon: 'book-open-variant', label: 'Reading', value: 'Reading' },
  { icon: 'airplane', label: 'Travel', value: 'Travel' },
  { icon: 'music', label: 'Music', value: 'Music' },
  { icon: 'dumbbell', label: 'Fitness', value: 'Fitness' },
  { icon: 'gamepad-variant', label: 'Gaming', value: 'Gaming' },
  { icon: 'chef-hat', label: 'Cooking', value: 'Cooking' },
  { icon: 'camera', label: 'Photography', value: 'Photography' },
  { icon: 'meditation', label: 'Yoga', value: 'Yoga' },
  { icon: 'drama-masks', label: 'Theater', value: 'Theater' },
  { icon: 'flower', label: 'Gardening', value: 'Gardening' },
  { icon: 'movie-open', label: 'Film', value: 'Film' },
  { icon: 'laptop', label: 'Tech', value: 'Tech' },
  { icon: 'pencil', label: 'Writing', value: 'Writing' },
  { icon: 'dog', label: 'Pets', value: 'Pets' },
  { icon: 'ticket', label: 'Live Events', value: 'Live Events' },
  { icon: 'pine-tree', label: 'Outdoors', value: 'Outdoors' },
  { icon: 'scissors-cutting', label: 'Crafts', value: 'Crafts' },
  { icon: 'glass-wine', label: 'Wine Tasting', value: 'Wine Tasting' },
  { icon: 'coffee', label: 'Coffee', value: 'Coffee' },
];

export const DEFAULT_HOBBY_ICON = 'star-four-points';

const hobbyIconMap = new Map(HOBBY_OPTIONS.map((h) => [h.value, h.icon]));
const predefinedValues = new Set(HOBBY_OPTIONS.map((h) => h.value));

export function getHobbyIcon(hobby: string): string {
  return hobbyIconMap.get(hobby) ?? DEFAULT_HOBBY_ICON;
}

export function isPredefinedHobby(hobby: string): boolean {
  return predefinedValues.has(hobby);
}

/** Strips leading non-alphanumeric chars (emoji prefixes) so old data displays correctly. */
export function normalizeHobbies(hobbies: string[]): string[] {
  return hobbies.map((h) => h.replace(/^[^a-zA-Z0-9]+/, '').trim());
}
