/**
 * Lock screen - PIN entry with optional biometric unlock.
 * Shown when the app opens with an existing wallet that has a PIN set.
 */

import { useCallback, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import { verifyPin, isBiometricsEnabled } from "../src/storage/secure-store";

const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function LockScreen() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isLockedOut = lockedUntil !== null && Date.now() < lockedUntil;

  const navigateToTabs = useCallback(() => {
    router.replace("/(tabs)");
  }, [router]);

  const startLockoutTimer = useCallback((until: number) => {
    if (lockoutTimerRef.current) {
      clearInterval(lockoutTimerRef.current);
    }
    const updateRemaining = () => {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(null);
        setLockoutRemaining(0);
        setAttempts(0);
        setError(null);
        if (lockoutTimerRef.current) {
          clearInterval(lockoutTimerRef.current);
          lockoutTimerRef.current = null;
        }
      } else {
        setLockoutRemaining(remaining);
      }
    };
    updateRemaining();
    lockoutTimerRef.current = setInterval(updateRemaining, 1000);
  }, []);

  // Attempt biometric auth on focus
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const tryBiometrics = async () => {
        try {
          const [hardwareAvailable, enrolled, enabled] = await Promise.all([
            LocalAuthentication.hasHardwareAsync(),
            LocalAuthentication.isEnrolledAsync(),
            isBiometricsEnabled(),
          ]);

          if (!hardwareAvailable || !enrolled || !enabled || cancelled) {
            return;
          }

          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: "Unlock FAIRWallet",
            disableDeviceFallback: false,
          });

          if (result.success && !cancelled) {
            navigateToTabs();
          }
        } catch (_biometricError: unknown) {
          // Biometric auth failed or unavailable - fall through to PIN entry
        }
      };
      tryBiometrics();
      return () => {
        cancelled = true;
        if (lockoutTimerRef.current) {
          clearInterval(lockoutTimerRef.current);
          lockoutTimerRef.current = null;
        }
      };
    }, [navigateToTabs]),
  );

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (verifying || isLockedOut) return;

      setError(null);
      setPin((prev) => {
        if (prev.length >= PIN_LENGTH) return prev;
        const next = prev + digit;

        if (next.length === PIN_LENGTH) {
          setVerifying(true);
          verifyPin(next)
            .then((correct) => {
              if (correct) {
                navigateToTabs();
              } else {
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);

                if (newAttempts >= MAX_ATTEMPTS) {
                  const until = Date.now() + LOCKOUT_SECONDS * 1000;
                  setLockedUntil(until);
                  setError(
                    `Too many attempts. Try again in ${LOCKOUT_SECONDS} seconds.`,
                  );
                  startLockoutTimer(until);
                } else {
                  setError(
                    `Wrong PIN. ${MAX_ATTEMPTS - newAttempts} attempt${
                      MAX_ATTEMPTS - newAttempts === 1 ? "" : "s"
                    } remaining.`,
                  );
                }
                setPin("");
              }
              setVerifying(false);
            })
            .catch(() => {
              setError("Verification failed. Try again.");
              setPin("");
              setVerifying(false);
            });
        }

        return next;
      });
    },
    [verifying, isLockedOut, attempts, navigateToTabs, startLockoutTimer],
  );

  const handleBackspace = useCallback(() => {
    if (verifying || isLockedOut) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  }, [verifying, isLockedOut]);

  return (
    <SafeAreaView className="flex-1 bg-fair-dark">
      <View className="flex-1 items-center justify-between px-6 pt-20 pb-10">
        {/* Header */}
        <View className="items-center">
          <Text className="text-fair-green text-3xl font-bold mb-2">FAIR</Text>
          <Text className="text-white text-xl font-medium mb-8">
            Enter PIN
          </Text>

          {/* PIN dots */}
          <View className="flex-row gap-4 mb-6">
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <View
                key={`dot-${i}`}
                className={`w-4 h-4 rounded-full ${
                  i < pin.length ? "bg-fair-green" : "bg-fair-dark-light"
                }`}
              />
            ))}
          </View>

          {/* Error / lockout */}
          {error ? (
            <Text className="text-red-400 text-sm text-center px-4">
              {error}
            </Text>
          ) : null}
          {isLockedOut && lockoutRemaining > 0 ? (
            <Text className="text-fair-muted text-sm mt-2">
              Locked for {lockoutRemaining}s
            </Text>
          ) : null}
        </View>

        {/* Number pad */}
        <View className="w-full max-w-xs">
          {[
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
            ["", "0", "back"],
          ].map((row, rowIdx) => (
            <View
              key={`row-${rowIdx}`}
              className="flex-row justify-around mb-4"
            >
              {row.map((key) => {
                if (key === "") {
                  return <View key="empty" className="w-20 h-16" />;
                }
                if (key === "back") {
                  return (
                    <Pressable
                      key="backspace"
                      className="w-20 h-16 items-center justify-center rounded-2xl active:bg-fair-dark-light"
                      onPress={handleBackspace}
                      disabled={isLockedOut}
                    >
                      <Text
                        className={`text-2xl ${
                          isLockedOut ? "text-fair-dark-light" : "text-fair-muted"
                        }`}
                      >
                        {"\u232B"}
                      </Text>
                    </Pressable>
                  );
                }
                return (
                  <Pressable
                    key={`key-${key}`}
                    className={`w-20 h-16 items-center justify-center rounded-2xl ${
                      isLockedOut
                        ? "bg-fair-dark-light/50"
                        : "bg-fair-dark-light active:bg-fair-green/20"
                    }`}
                    onPress={() => handleDigitPress(key)}
                    disabled={isLockedOut}
                  >
                    <Text
                      className={`text-2xl font-medium ${
                        isLockedOut ? "text-fair-muted/50" : "text-white"
                      }`}
                    >
                      {key}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
