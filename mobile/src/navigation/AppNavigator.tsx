// ============================================================
// HealthGuard Mobile - App Navigator
// ============================================================
// Root navigation: Auth stack (unauthenticated) or Main tabs
// (authenticated). Tab bar is elderly-friendly with large
// icons, labels, and an 80pt height.
// ============================================================

import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import { colors, typography, layout } from '../theme';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import OTPScreen from '../screens/auth/OTPScreen';

// Main screens
import DashboardScreen from '../screens/home/DashboardScreen';
import HospitalSearchScreen from '../screens/hospital/HospitalSearchScreen';
import HospitalDetailScreen from '../screens/hospital/HospitalDetailScreen';
import EmergencyScreen from '../screens/emergency/EmergencyScreen';
import AIChatScreen from '../screens/ai/AIChatScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// ── Navigation Types ──────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  OTP: { sessionId: string; phoneNumber: string };
};

export type HospitalStackParamList = {
  HospitalSearch: undefined;
  HospitalDetail: { hospitalId: string; hospitalName: string };
};

export type MainTabParamList = {
  Home: undefined;
  Hospitals: undefined;
  Emergency: undefined;
  AIChat: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

// ── Stack Navigators ──────────────────────────────────────────

const AuthStack = createStackNavigator<AuthStackParamList>();
const HospitalStack = createStackNavigator<HospitalStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createStackNavigator<RootStackParamList>();

// ── Auth Navigator ────────────────────────────────────────────

const AuthNavigator: React.FC = () => (
  <AuthStack.Navigator
    screenOptions={{
      headerShown: false,
      cardStyle: { backgroundColor: colors.background },
    }}
  >
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="OTP" component={OTPScreen} />
  </AuthStack.Navigator>
);

// ── Hospital Navigator ────────────────────────────────────────

const HospitalNavigator: React.FC = () => (
  <HospitalStack.Navigator
    screenOptions={{
      headerShown: false,
      cardStyle: { backgroundColor: colors.background },
    }}
  >
    <HospitalStack.Screen name="HospitalSearch" component={HospitalSearchScreen} />
    <HospitalStack.Screen name="HospitalDetail" component={HospitalDetailScreen} />
  </HospitalStack.Navigator>
);

// ── Main Tab Navigator ────────────────────────────────────────

const MainTabNavigator: React.FC = () => (
  <MainTab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: styles.tabBar,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textTertiary,
      tabBarLabelStyle: styles.tabBarLabel,
      tabBarIconStyle: styles.tabBarIcon,
      tabBarHideOnKeyboard: true,
    }}
  >
    <MainTab.Screen
      name="Home"
      component={DashboardScreen}
      options={{
        tabBarLabel: 'Home',
        tabBarIcon: ({ color, size }) => (
          <Icon name="heart-pulse" size={28} color={color} />
        ),
        tabBarAccessibilityLabel: 'Home - Health Dashboard',
      }}
    />
    <MainTab.Screen
      name="Hospitals"
      component={HospitalNavigator}
      options={{
        tabBarLabel: 'Hospitals',
        tabBarIcon: ({ color, size }) => (
          <Icon name="hospital-building" size={28} color={color} />
        ),
        tabBarAccessibilityLabel: 'Find Hospitals',
      }}
    />
    <MainTab.Screen
      name="Emergency"
      component={EmergencyScreen}
      options={{
        tabBarLabel: 'SOS',
        tabBarIcon: ({ color, focused }) => (
          <View style={[styles.sosIconContainer, focused && styles.sosIconFocused]}>
            <Icon
              name="alert-octagon"
              size={32}
              color={colors.white}
            />
          </View>
        ),
        tabBarLabelStyle: styles.sosLabel,
        tabBarActiveTintColor: colors.danger,
        tabBarAccessibilityLabel: 'Emergency SOS',
      }}
    />
    <MainTab.Screen
      name="AIChat"
      component={AIChatScreen}
      options={{
        tabBarLabel: 'AI Chat',
        tabBarIcon: ({ color, size }) => (
          <Icon name="chat-processing" size={28} color={color} />
        ),
        tabBarAccessibilityLabel: 'AI Health Chat',
      }}
    />
    <MainTab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        tabBarLabel: 'Profile',
        tabBarIcon: ({ color, size }) => (
          <Icon name="account" size={28} color={color} />
        ),
        tabBarAccessibilityLabel: 'My Profile',
      }}
    />
  </MainTab.Navigator>
);

// ── Root Navigator ────────────────────────────────────────────

const AppNavigator: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      {isAuthenticated ? (
        <RootStack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
};

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    height: layout.tabBarHeight,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  tabBarLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginTop: 4,
  },
  tabBarIcon: {
    marginTop: 2,
  },
  sosIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
    elevation: 6,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  sosIconFocused: {
    backgroundColor: '#A51E1E',
    transform: [{ scale: 1.05 }],
  },
  sosLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginTop: 4,
    color: colors.danger,
  },
});

export default AppNavigator;
