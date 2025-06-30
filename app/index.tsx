import { Redirect } from 'expo-router';

export default function Index() {
  // This will redirect to the login screen, and the AuthContext will handle
  // redirecting to main if the user is already authenticated
  return <Redirect href="/login" />;
}
