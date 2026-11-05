import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View, type TextInputInstance } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { Button, ErrorBox, Icon, Input, T } from './ui';
import { colors, font, space } from '@/theme';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<TextInputInstance>(null);
  const pwRef = useRef<TextInputInstance>(null);
  const isRegister = mode === 'register';

  async function submit() {
    setError(null);
    if (isRegister && name.trim().length < 2) return setError('Informe seu nome');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Informe um e-mail válido');
    if (isRegister && password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres');
    setLoading(true);
    try {
      if (isRegister) {
        await register(name.trim(), email.trim(), password);
        router.replace('/quiz');
      } else {
        await login(email.trim(), password);
        router.replace('/');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível continuar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: space(6), gap: space(5), maxWidth: 480, width: '100%', alignSelf: 'center' }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} hitSlop={12} style={{ alignSelf: 'flex-start' }}>
            <Icon name="arrow-back" size={24} />
          </Pressable>
          <View style={{ gap: space(2) }}>
            <T v="h1">{isRegister ? 'Crie sua conta' : 'Bem-vindo(a) de volta'}</T>
            <T v="body" color={colors.textMuted}>
              {isRegister ? 'Leva 30 segundos. Depois, um quiz rápido monta seu plano.' : 'Entre para ver suas trilhas e seus ganhos.'}
            </T>
          </View>

          <View style={{ gap: space(4) }}>
            {isRegister && (
              <Input label="Nome" icon="person-outline" value={name} onChangeText={setName} placeholder="Como quer ser chamado(a)" autoComplete="name" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
            )}
            <Input
              ref={emailRef}
              label="E-mail"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => pwRef.current?.focus()}
            />
            <View>
              <Input
                ref={pwRef}
                label="Senha"
                icon="lock-closed-outline"
                value={password}
                onChangeText={setPassword}
                placeholder={isRegister ? 'Mínimo de 8 caracteres' : 'Sua senha'}
                secureTextEntry={!showPw}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                returnKeyType="go"
                onSubmitEditing={submit}
              />
              <Pressable onPress={() => setShowPw((s) => !s)} style={{ position: 'absolute', right: 16, top: 38 }} hitSlop={10}>
                <Icon name={showPw ? 'eye-off-outline' : 'eye-outline'} color={colors.textSoft} />
              </Pressable>
            </View>
            {error && <ErrorBox message={error} />}
            <Button title={isRegister ? 'Criar conta grátis' : 'Entrar'} onPress={submit} loading={loading} />
          </View>

          <Pressable onPress={() => router.replace(isRegister ? '/login' : '/register')} style={{ alignSelf: 'center' }}>
            <T v="small" color={colors.textMuted}>
              {isRegister ? 'Já tem conta? ' : 'Ainda não tem conta? '}
              <T v="small" color={colors.brand} style={{ fontFamily: font.bold }}>
                {isRegister ? 'Entrar' : 'Criar conta'}
              </T>
            </T>
          </Pressable>
          {isRegister && (
            <T v="caption" color={colors.textSoft} style={{ textAlign: 'center' }}>
              Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade (LGPD).
            </T>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
