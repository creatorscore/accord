/**
 * Shim for react-native-device-info to work with Expo
 * Required by sp-react-native-in-app-updates
 */
import Constants from 'expo-constants';

export const getBundleId = () => {
  return Constants.expoConfig?.ios?.bundleIdentifier ??
         Constants.expoConfig?.android?.package ??
         'com.privyreviews.accord';
};

export const getVersion = () => {
  return Constants.expoConfig?.version ?? '1.0.0';
};

export default {
  getBundleId,
  getVersion,
};
