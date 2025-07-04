import { Redirect } from 'expo-router';

export default function Index() {
  // This is the root index, it just redirects to the tabs
  return <Redirect href="/(tabs)" />;
}