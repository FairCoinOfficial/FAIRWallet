/**
 * Network status hook using expo-network.
 * Tracks connection state in real time.
 */

import * as Network from "expo-network";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: Network.NetworkStateType | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: null,
  });

  const subscribed = useRef(false);

  useFocusEffect(
    useCallback(() => {
      Network.getNetworkStateAsync().then((state) => {
        setStatus({
          isConnected: state.isConnected ?? true,
          isInternetReachable: state.isInternetReachable ?? true,
          type: state.type ?? null,
        });
      });

      if (!subscribed.current) {
        subscribed.current = true;
        Network.addNetworkStateListener((state) => {
          setStatus({
            isConnected: state.isConnected ?? true,
            isInternetReachable: state.isInternetReachable ?? true,
            type: state.type ?? null,
          });
        });
      }
    }, []),
  );

  return status;
}
