/**
 * Lock screen — Revolut-style PIN entry with optional biometric unlock.
 * Shown when the app opens with an existing wallet that has a PIN set.
 */

import { useCallback, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { verifyPin, isBiometricsEnabled } from "../src/storage/secure-store";
import { PinPad } from "../src/ui/components/PinPad";
import { PinDots } from "../src/ui/components/PinDots";
import { useTheme } from "@oxyhq/bloom/theme";

const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function LockScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
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

  const tryBiometricAuth = useCallback(async () => {
    try {
      const [hardwareAvailable, enrolled, enabled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        isBiometricsEnabled(),
      ]);

      if (!hardwareAvailable || !enrolled || !enabled) {
        return;
      }

      setBiometricsAvailable(true);

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock FAIRWallet",
        disableDeviceFallback: false,
      });

      if (result.success) {
        navigateToTabs();
      }
    } catch (_biometricError: unknown) {
      // Biometric auth failed or unavailable — fall through to PIN entry
    }
  }, [navigateToTabs]);

  // Attempt biometric auth on focus
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const init = async () => {
        const [hardwareAvailable, enrolled, enabled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          isBiometricsEnabled(),
        ]).catch(() => [false, false, false] as const);

        if (cancelled) return;

        if (hardwareAvailable && enrolled && enabled) {
          setBiometricsAvailable(true);

          try {
            const result = await LocalAuthentication.authenticateAsync({
              promptMessage: "Unlock FAIRWallet",
              disableDeviceFallback: false,
            });

            if (result.success && !cancelled) {
              navigateToTabs();
            }
          } catch (_e: unknown) {
            // Biometric failed — user falls through to PIN
          }
        }
      };

      init();

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
                    `Too many attempts. Try again in ${LOCKOUT_SECONDS}s.`,
                  );
                  startLockoutTimer(until);
                } else {
                  setError(
                    `Wrong passcode. ${MAX_ATTEMPTS - newAttempts} attempt${
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

  const biometricButton = biometricsAvailable ? (
    <Pressable
      className="w-18 h-18 rounded-full items-center justify-center active:bg-primary/10"
      onPress={tryBiometricAuth}
      disabled={isLockedOut}
    >
      <MaterialCommunityIcons
        name="fingerprint"
        size={28}
        color={isLockedOut ? theme.colors.card : theme.colors.primary}
      />
    </Pressable>
  ) : undefined;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-between px-6 pt-16 pb-8">
        {/* Brand + prompt */}
        <View className="items-center flex-1 justify-center">
          <Text className="text-primary text-5xl mb-8">{"\u229C"}</Text>

          <Text className="text-foreground text-xl font-semibold mb-8">
            Enter your passcode
          </Text>

          <PinDots
            length={PIN_LENGTH}
            filled={pin.length}
            error={error !== null}
          />

          {/* Error / lockout messages */}
          <View className="h-12 justify-center mt-4">
            {error ? (
              <Text className="text-red-400 text-sm text-center px-4">
                {error}
              </Text>
            ) : null}
            {isLockedOut && lockoutRemaining > 0 ? (
              <Text className="text-muted-foreground text-sm text-center">
                Locked for {lockoutRemaining}s
              </Text>
            ) : null}
          </View>
        </View>

        {/* Number pad */}
        <View className="w-full pb-4">
          <PinPad
            onDigit={handleDigitPress}
            onBackspace={handleBackspace}
            disabled={isLockedOut || verifying}
            biometricButton={biometricButton}
            tintColor={theme.colors.text}
            disabledColor={theme.colors.card}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
