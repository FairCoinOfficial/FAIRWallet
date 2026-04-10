/**
 * Create wallet flow.
 * Generates mnemonic, displays it, then verifies the user recorded it.
 */

import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWalletStore } from "../../src/wallet/wallet-store";
import { Button } from "../../src/ui/components/Button";

type Step = "generating" | "display" | "verify" | "complete";

const VERIFY_COUNT = 3;

function pickRandomIndices(total: number, count: number): number[] {
  const indices: number[] = [];
  while (indices.length < count) {
    const idx = Math.floor(Math.random() * total);
    if (!indices.includes(idx)) {
      indices.push(idx);
    }
  }
  return indices.sort((a, b) => a - b);
}

/** Fisher-Yates (Knuth) shuffle — unbiased in-place shuffle. */
function fisherYatesShuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/** Build shuffled options for verification, ensuring the correct word is included. */
function buildShuffledOptions(words: string[], correctWord: string): string[] {
  const shuffled = fisherYatesShuffle(words).slice(0, 6);
  if (!shuffled.includes(correctWord)) {
    shuffled[0] = correctWord;
  }
  return fisherYatesShuffle(shuffled);
}

export default function CreateWalletScreen() {
  const router = useRouter();
  const createWallet = useWalletStore((s) => s.createWallet);

  const [step, setStep] = useState<Step>("generating");
  const [words, setWords] = useState<string[]>([]);
  const [verifyIndices, setVerifyIndices] = useState<number[]>([]);
  const [currentVerifyIdx, setCurrentVerifyIdx] = useState(0);
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    try {
      const mnemonic = await createWallet();
      const wordList = mnemonic.split(" ");
      setWords(wordList);
      setStep("display");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to generate wallet";
      setError(msg);
    }
  }, [createWallet]);

  // Trigger generation on first render via button
  const isGenerating = step === "generating";

  const handleWrittenDown = useCallback(() => {
    const indices = pickRandomIndices(words.length, VERIFY_COUNT);
    setVerifyIndices(indices);
    setCurrentVerifyIdx(0);

    // Create shuffled options for the first word
    const correctWord = words[indices[0]];
    setShuffledOptions(buildShuffledOptions(words, correctWord));
    setStep("verify");
  }, [words]);

  const handleVerifySelect = useCallback(
    (selectedWord: string) => {
      const expectedIdx = verifyIndices[currentVerifyIdx];
      const expectedWord = words[expectedIdx];

      if (selectedWord !== expectedWord) {
        setError("Wrong word. Please try again.");
        return;
      }

      setError(null);
      const nextIdx = currentVerifyIdx + 1;

      if (nextIdx >= VERIFY_COUNT) {
        setStep("complete");
        router.replace("/onboarding/pin-setup");
        return;
      }

      setCurrentVerifyIdx(nextIdx);

      // Prepare next options
      const nextCorrectWord = words[verifyIndices[nextIdx]];
      setShuffledOptions(buildShuffledOptions(words, nextCorrectWord));
    },
    [
      verifyIndices,
      currentVerifyIdx,
      words,
      router,
    ],
  );

  const currentVerifyPosition = useMemo(() => {
    if (verifyIndices.length === 0) return 0;
    return verifyIndices[currentVerifyIdx] + 1;
  }, [verifyIndices, currentVerifyIdx]);

  if (isGenerating) {
    return (
      <SafeAreaView className="flex-1 bg-fair-dark">
        <View className="flex-1 items-center justify-center px-8">
          {error ? (
            <>
              <Text className="text-red-400 text-base mb-4">{error}</Text>
              <Button
                title="Retry"
                onPress={handleGenerate}
                variant="primary"
              />
            </>
          ) : (
            <>
              <Text className="text-white text-lg mb-6">
                Generate your wallet
              </Text>
              <Button
                title="Generate 24-Word Recovery Phrase"
                onPress={handleGenerate}
                variant="primary"
              />
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (step === "display") {
    return (
      <SafeAreaView className="flex-1 bg-fair-dark">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pt-20 pb-8"
        >
          <Text className="text-white text-xl font-bold mb-2 text-center">
            Your Recovery Phrase
          </Text>
          <Text className="text-fair-muted text-sm mb-6 text-center">
            Write these words down and store them safely. They are the ONLY way
            to recover your wallet.
          </Text>

          {/* Warning */}
          <View className="bg-red-900/30 border border-red-600/50 rounded-xl p-4 mb-6">
            <Text className="text-red-400 text-sm text-center">
              Never share your recovery phrase. Anyone with these words can steal
              your funds.
            </Text>
          </View>

          {/* Word grid: 4 columns x 6 rows */}
          <View className="flex-row flex-wrap gap-2 mb-8">
            {words.map((word, idx) => (
              <View
                key={`word-${idx}-${word}`}
                className="bg-fair-dark-light border border-fair-border rounded-lg px-3 py-2 w-[23%]"
              >
                <Text className="text-fair-muted text-xs">{idx + 1}</Text>
                <Text className="text-white text-sm font-medium">{word}</Text>
              </View>
            ))}
          </View>

          <Button
            title="I have written them down"
            onPress={handleWrittenDown}
            variant="primary"
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === "verify") {
    return (
      <SafeAreaView className="flex-1 bg-fair-dark">
        <View className="flex-1 px-6 pt-20">
          <Text className="text-white text-xl font-bold mb-2 text-center">
            Verify Your Phrase
          </Text>
          <Text className="text-fair-muted text-sm mb-8 text-center">
            Select word #{currentVerifyPosition}
          </Text>

          {/* Progress */}
          <View className="flex-row justify-center gap-2 mb-8">
            {verifyIndices.map((_, idx) => (
              <View
                key={`progress-${idx}`}
                className={`w-3 h-3 rounded-full ${
                  idx < currentVerifyIdx
                    ? "bg-fair-green"
                    : idx === currentVerifyIdx
                      ? "bg-fair-green-dim"
                      : "bg-fair-dark-light"
                }`}
              />
            ))}
          </View>

          {error ? (
            <Text className="text-red-400 text-sm mb-4 text-center">
              {error}
            </Text>
          ) : null}

          {/* Options */}
          <View className="gap-3">
            {shuffledOptions.map((option, idx) => (
              <Pressable
                key={idx}
                className="bg-fair-dark-light border border-fair-border rounded-xl py-4 px-6 items-center"
                onPress={() => handleVerifySelect(option)}
              >
                <Text className="text-white text-base">{option}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Complete state (briefly shown before redirect)
  return (
    <View className="flex-1 bg-fair-dark items-center justify-center">
      <ActivityIndicator size="large" color="#9ffb50" />
      <Text className="text-white text-base mt-4">Setting up wallet...</Text>
    </View>
  );
}
