import { Redirect } from 'expo-router';

// The Messages tab was merged into the Matches tab (new-matches carousel +
// conversation list in one screen). This route sticks around because push
// notifications, cross-tab pushes, and muscle-memory deep links still point
// at /(tabs)/messages — it simply forwards to the combined screen. The tab
// itself is hidden in _layout.tsx via href: null.
export default function Messages() {
  return <Redirect href="/(tabs)/matches" />;
}
