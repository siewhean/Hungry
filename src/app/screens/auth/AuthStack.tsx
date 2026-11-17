import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { AuthStackParamList } from "@/app/navigation/navigationTypes";
import { FeedErrorBoundary } from "@/components/ui";
import { ChangePasswordScreen } from "./ChangePasswordScreen";
import { EmailVerificationScreen } from "./EmailVerificationScreen";
import { ForgotPasswordScreen } from "./ForgotPasswordScreen";
import { LoginScreen } from "./LoginScreen";
import { ResetPasswordScreen } from "./ResetPasswordScreen";
import { ResetPasswordSuccessScreen } from "./ResetPasswordSuccessScreen";
import { SignUpScreen } from "./SignUpScreen";

export type { AuthStackParamList } from "@/app/navigation/navigationTypes";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <FeedErrorBoundary
      title="Authentication is currently unavailable"
      body="We're having trouble connecting to our security services. Please check your connection or try again in a moment."
    >
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="ResetPasswordSuccess" component={ResetPasswordSuccessScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      </Stack.Navigator>
    </FeedErrorBoundary>
  );
}
