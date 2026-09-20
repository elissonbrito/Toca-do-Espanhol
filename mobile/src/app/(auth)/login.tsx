import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password) {
      setError('Informe e-mail e senha.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        setError('E-mail ou senha inválidos.');
      } else if (status === 403) {
        setError('Conta desativada. Contate o administrador.');
      } else {
        setError('Não foi possível conectar ao servidor.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <View pointerEvents="none" style={styles.glowRed} />
      <View pointerEvents="none" style={styles.glowGold} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.form}>
          <View style={styles.header}>
            <BrandLogo />
            <ThemedText type="title" style={styles.title}>
              Toca do Espanhol
            </ThemedText>
            <ThemedText color="muted">Sistema de Gestão Operacional</ThemedText>
          </View>

          <ThemedView card style={styles.card}>
            <ThemedText type="subtitle" style={styles.cardTitle}>
              Entrar no sistema
            </ThemedText>

            <View style={styles.field}>
              <ThemedText type="label" color="muted">
                E-mail
              </ThemedText>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={16} color={Colors.muted} style={styles.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="seu@email.com"
                  placeholderTextColor={Colors.muted}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.field}>
              <ThemedText type="label" color="muted">
                Senha
              </ThemedText>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={16} color={Colors.muted} style={styles.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.muted}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  style={[styles.input, styles.inputWithTrailingIcon]}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={12}
                  style={styles.trailingIcon}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={16}
                    color={Colors.muted}
                  />
                </Pressable>
              </View>
            </View>

            {error && (
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            )}

            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={[styles.button, isSubmitting && styles.buttonDisabled]}>
              {isSubmitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <ThemedText type="smallBold" style={styles.buttonText}>
                  Entrar
                </ThemedText>
              )}
            </Pressable>

            <View style={styles.footer}>
              <ThemedText type="small" color="muted" style={styles.footerText}>
                Acesso restrito aos funcionários da Toca do Espanhol
              </ThemedText>
            </View>
          </ThemedView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  // Aproxima o efeito de brilho difuso do fundo do login original (blur com
  // CSS não existe em React Native puro — usamos círculos translúcidos).
  glowRed: {
    position: 'absolute',
    top: -160,
    right: -160,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: Colors.red,
    opacity: 0.12,
  },
  glowGold: {
    position: 'absolute',
    bottom: -160,
    left: -160,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: Colors.gold,
    opacity: 0.1,
  },
  form: {
    gap: Spacing.five,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    textAlign: 'center',
  },
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  cardTitle: {
    marginBottom: Spacing.one,
  },
  field: {
    gap: Spacing.one,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: Spacing.three,
    zIndex: 1,
  },
  trailingIcon: {
    position: 'absolute',
    right: Spacing.three,
  },
  input: {
    backgroundColor: Colors.dark,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingLeft: Spacing.six * 0.5,
    paddingVertical: Spacing.two + 4,
    fontSize: 16,
    color: Colors.white,
  },
  inputWithTrailingIcon: {
    paddingRight: Spacing.six * 0.5,
  },
  error: {
    color: Colors.redLight,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.red,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.white,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.three,
    marginTop: Spacing.one,
  },
  footerText: {
    textAlign: 'center',
  },
});
