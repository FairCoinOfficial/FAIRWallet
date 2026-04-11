/**
 * QR code scanner component using expo-camera.
 * Scans QR codes and extracts FairCoin addresses from:
 * - faircoin:<address> URIs
 * - Plain addresses (starting with F or T)
 */

import { useCallback, useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Button } from "./Button";

interface QRScannerProps {
  visible: boolean;
  onScan: (address: string) => void;
  onClose: () => void;
}

/**
 * Parse a scanned QR string to extract a FairCoin address.
 * Supports:
 *   faircoin:FxxxxAddress?amount=1.0
 *   faircoin:FxxxxAddress
 *   FxxxxAddress (raw)
 *   TxxxxAddress (testnet raw)
 */
function parseScannedData(data: string): string | null {
  const trimmed = data.trim();

  // faircoin: URI scheme
  if (trimmed.toLowerCase().startsWith("faircoin:")) {
    const withoutScheme = trimmed.slice("faircoin:".length);
    // Strip query params if present
    const address = withoutScheme.split("?")[0];
    if (address && address.length >= 25) {
      return address;
    }
    return null;
  }

  // Raw address starting with F (mainnet) or T (testnet)
  if (
    (trimmed.startsWith("F") || trimmed.startsWith("T")) &&
    trimmed.length >= 25 &&
    trimmed.length <= 36
  ) {
    return trimmed;
  }

  return null;
}

export function QRScanner({ visible, onScan, onClose }: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarCodeScanned = useCallback(
    (result: { data: string }) => {
      if (scanned) return;

      const address = parseScannedData(result.data);
      if (address) {
        setScanned(true);
        onScan(address);
        onClose();
        // Reset scanned state after modal closes
        setTimeout(() => setScanned(false), 500);
      }
    },
    [scanned, onScan, onClose],
  );

  const handleClose = useCallback(() => {
    setScanned(false);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black">
        {/* Header */}
        <View className="pt-14 pb-4 px-6 flex-row items-center justify-between bg-black/80 z-10">
          <Text className="text-white text-lg font-bold">Scan QR Code</Text>
          <Pressable onPress={handleClose} className="p-2">
            <Text className="text-primary text-base font-semibold">
              Close
            </Text>
          </Pressable>
        </View>

        {/* Camera or permission request */}
        {permission === null ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted-foreground text-base">
              Checking camera permission...
            </Text>
          </View>
        ) : !permission.granted ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-white text-base text-center mb-4">
              Camera access is needed to scan QR codes
            </Text>
            <Button
              title="Grant Camera Access"
              onPress={requestPermission}
              variant="primary"
            />
          </View>
        ) : (
          <View className="flex-1">
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            />

            {/* Scanning overlay */}
            <View className="absolute inset-0 items-center justify-center">
              {/* Top dimmer */}
              <View className="absolute top-0 left-0 right-0 h-1/4 bg-black/50" />
              {/* Bottom dimmer */}
              <View className="absolute bottom-0 left-0 right-0 h-1/4 bg-black/50" />
              {/* Left dimmer */}
              <View className="absolute top-1/4 left-0 w-1/6 bottom-1/4 bg-black/50" />
              {/* Right dimmer */}
              <View className="absolute top-1/4 right-0 w-1/6 bottom-1/4 bg-black/50" />

              {/* Scanning frame */}
              <View className="w-64 h-64 border-2 border-primary rounded-2xl" />

              <Text className="text-white text-sm mt-6">
                Point camera at a FairCoin QR code
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
