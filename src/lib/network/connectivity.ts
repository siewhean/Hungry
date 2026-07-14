import type { NetInfoState } from "@react-native-community/netinfo";

type ConnectivityState = Pick<NetInfoState, "isConnected" | "isInternetReachable">;

export function isNetworkOffline({ isConnected, isInternetReachable }: ConnectivityState): boolean {
  return isConnected === false || isInternetReachable === false;
}
