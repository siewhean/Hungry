import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { AuthStackParamList } from "@/app/navigation/navigationTypes";
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
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="ResetPasswordSuccess" component={ResetPasswordSuccessScreen} />
    </Stack.Navigator>
  );
}
