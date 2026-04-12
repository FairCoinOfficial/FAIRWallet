/**
 * Reusable button component with multiple variants and sizes.
 */

import { useMemo, useCallback } from "react";
import {
  Text,
  View,
  Pressable,
  ActivityIndicator,
  type GestureResponderEvent,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@oxyhq/bloom/theme";

type ButtonVariant = "primary" | "secondary" | "danger" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
  style?: ViewStyle;
}

const VARIANT_CONTAINER_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary",
  secondary: "bg-surface",
  danger: "bg-red-600",
  outline: "border border-primary bg-transparent",
  ghost: "bg-transparent",
};

const VARIANT_TEXT_CLASSES: Record<ButtonVariant, string> = {
  primary: "text-primary-foreground",
  secondary: "text-foreground",
  danger: "text-destructive-foreground",
  outline: "text-primary",
  ghost: "text-primary",
};

const SIZE_CONTAINER_CLASSES: Record<ButtonSize, string> = {
  sm: "py-2 px-4",
  md: "py-3 px-6",
  lg: "py-4 px-8",
};

const SIZE_TEXT_CLASSES: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon,
  iconPosition = "left",
  fullWidth = true,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const theme = useTheme();

  const spinnerColors: Record<ButtonVariant, string> = useMemo(
    () => ({
      primary: theme.colors.background,
      secondary: theme.colors.text,
      danger: theme.colors.text,
      outline: theme.colors.primary,
      ghost: theme.colors.primary,
    }),
    [theme],
  );

  const containerClassName = useMemo(() => {
    const base = "rounded-full items-center justify-center flex-row";
    const variantClass = VARIANT_CONTAINER_CLASSES[variant];
    const sizeClass = SIZE_CONTAINER_CLASSES[size];
    const widthClass = fullWidth ? "w-full" : "";
    const disabledClass = isDisabled ? "opacity-50" : "";
    return `${base} ${variantClass} ${sizeClass} ${widthClass} ${disabledClass}`.trim();
  }, [variant, size, fullWidth, isDisabled]);

  const textClassName = useMemo(() => {
    const base = "font-semibold";
    const variantClass = VARIANT_TEXT_CLASSES[variant];
    const sizeClass = SIZE_TEXT_CLASSES[size];
    return `${base} ${variantClass} ${sizeClass}`;
  }, [variant, size]);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (!isDisabled) {
        onPress(event);
      }
    },
    [isDisabled, onPress],
  );

  const spinnerColor = spinnerColors[variant];

  return (
    <Pressable
      className={containerClassName}
      onPress={handlePress}
      disabled={isDisabled}
      style={style}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} className="mr-2" />
      ) : null}
      {icon && iconPosition === "left" && !loading ? (
        <View className="mr-2">{icon}</View>
      ) : null}
      <Text className={textClassName}>{title}</Text>
      {icon && iconPosition === "right" && !loading ? (
        <View className="ml-2">{icon}</View>
      ) : null}
    </Pressable>
  );
}
