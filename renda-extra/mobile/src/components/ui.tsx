import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { colors, font, radius, shadow, space } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color = colors.text, style }: { name: string; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const valid = (Ionicons.glyphMap as Record<string, number>)[name] !== undefined;
  return <Ionicons name={(valid ? name : 'ellipse-outline') as IconName} size={size} color={color} style={style} />;
}

type Variant = 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'small' | 'caption' | 'label' | 'number';
const variants: Record<Variant, TextStyle> = {
  h1: { fontFamily: font.black, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  h2: { fontFamily: font.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  h3: { fontFamily: font.bold, fontSize: 18, lineHeight: 24 },
  title: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  number: { fontFamily: font.black, fontSize: 34, lineHeight: 40, letterSpacing: -1 },
};

export function T({ v = 'body', color = colors.text, style, ...rest }: TextProps & { v?: Variant; color?: string }) {
  return <Text {...rest} style={[variants[v], { color }, style]} />;
}

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  contentStyle,
  refreshControl,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ComponentProps<typeof ScrollView>['refreshControl'];
}) {
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ padding: space(5), paddingBottom: space(16), gap: space(4) }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, shadow, pressed && { transform: [{ scale: 0.985 }], opacity: 0.96 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, shadow, style]}>{children}</View>;
}

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold' | 'danger' | 'dark';
  icon?: string;
  iconRight?: string;
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg' | 'sm';
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = 'primary', icon, iconRight, loading, disabled, size = 'lg', style }: ButtonProps) {
  const palette = {
    primary: { bg: colors.brand, fg: colors.white, border: colors.brand },
    secondary: { bg: colors.brandTint, fg: colors.brandDark, border: colors.brandSoft },
    ghost: { bg: 'transparent', fg: colors.text, border: colors.border },
    gold: { bg: colors.gold, fg: '#1F1300', border: colors.gold },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
    dark: { bg: colors.text, fg: colors.white, border: colors.text },
  }[variant];
  const h = size === 'lg' ? 54 : size === 'md' ? 46 : 36;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.button,
        { height: h, backgroundColor: palette.bg, borderColor: palette.border, paddingHorizontal: size === 'sm' ? 14 : 20 },
        (disabled || loading) && { opacity: 0.55 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={size === 'sm' ? 16 : 19} color={palette.fg} />}
          <T v={size === 'sm' ? 'caption' : 'title'} color={palette.fg} style={size === 'sm' ? { fontFamily: font.semibold } : null}>
            {title}
          </T>
          {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 19} color={palette.fg} />}
        </>
      )}
    </Pressable>
  );
}

export function Chip({ label, active, onPress, icon, tone = 'brand' }: { label: string; active?: boolean; onPress?: () => void; icon?: string; tone?: 'brand' | 'dark' }) {
  const activeBg = tone === 'dark' ? colors.text : colors.brand;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        active ? { backgroundColor: activeBg, borderColor: activeBg } : null,
        pressed && { opacity: 0.8 },
      ]}
    >
      {icon && <Icon name={icon} size={15} color={active ? colors.white : colors.textMuted} />}
      <T v="caption" color={active ? colors.white : colors.text} style={{ fontFamily: font.semibold }}>
        {label}
      </T>
    </Pressable>
  );
}

export function Pill({ label, icon, bg = colors.brandTint, fg = colors.brandDark }: { label: string; icon?: string; bg?: string; fg?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon && <Icon name={icon} size={12} color={fg} />}
      <T v="caption" color={fg} style={{ fontFamily: font.semibold, fontSize: 11 }}>
        {label}
      </T>
    </View>
  );
}

export const Input = forwardRef<TextInputInstance, ComponentProps<typeof TextInput> & { label?: string; error?: string | null; icon?: string }>(
  function Input({ label, error, icon, style, ...rest }, ref) {
    return (
      <View style={{ gap: 6 }}>
        {label && (
          <T v="caption" color={colors.textMuted}>
            {label}
          </T>
        )}
        <View style={[styles.input, error ? { borderColor: colors.danger } : null]}>
          {icon && <Icon name={icon} size={18} color={colors.textSoft} />}
          <TextInput
            ref={ref}
            placeholderTextColor={colors.textSoft}
            style={[{ flex: 1, fontFamily: font.medium, fontSize: 16, color: colors.text, paddingVertical: 0, outlineStyle: 'none' } as unknown as TextStyle, style]}
            {...rest}
          />
        </View>
        {error ? (
          <T v="caption" color={colors.danger}>
            {error}
          </T>
        ) : null}
      </View>
    );
  },
);

export function ProgressBar({ pct, color = colors.brand, track = colors.brandSoft, height = 8 }: { pct: number; color?: string; track?: string; height?: number }) {
  return (
    <View style={{ height, backgroundColor: track, borderRadius: radius.pill, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', backgroundColor: color, borderRadius: radius.pill }} />
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space(2) }}>
      <T v="h3">{title}</T>
      {action && (
        <Pressable onPress={onAction} hitSlop={10}>
          <T v="small" color={colors.brand} style={{ fontFamily: font.semibold }}>
            {action}
          </T>
        </Pressable>
      )}
    </View>
  );
}

export function EmptyState({ icon, title, text, action, onAction }: { icon: string; title: string; text: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: 'center', padding: space(8), gap: space(3) }}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={30} color={colors.brand} />
      </View>
      <T v="h3" style={{ textAlign: 'center' }}>
        {title}
      </T>
      <T v="body" color={colors.textMuted} style={{ textAlign: 'center', maxWidth: 300 }}>
        {text}
      </T>
      {action && <Button title={action} onPress={onAction} size="md" style={{ marginTop: space(2) }} />}
    </View>
  );
}

export function IconBubble({ name, color, size = 46 }: { name: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: color + '1A', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={size * 0.48} color={color} />
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(10), backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.brand} size="large" />
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBox}>
      <Icon name="alert-circle" color={colors.danger} />
      <T v="small" color={colors.danger} style={{ flex: 1 }}>
        {message}
      </T>
      {onRetry && (
        <Pressable onPress={onRetry}>
          <T v="small" color={colors.danger} style={{ fontFamily: font.bold }}>
            Tentar de novo
          </T>
        </Pressable>
      )}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space(4), borderWidth: 1, borderColor: '#EEF2F0' },
  button: { borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 54,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
});
