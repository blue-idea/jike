import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { authFormStyles } from '@/components/auth/authFormStyles';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await signIn(email, password);
      if (err) {
        setError(err);
        return;
      }
      router.replace('/(tabs)');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreenShell title="欢迎回来" subtitle="登录后即可探索名录、地图与路线。">
      <View style={authFormStyles.field}>
        <Text style={authFormStyles.label}>邮箱</Text>
        <TextInput
          style={authFormStyles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="name@example.com"
          placeholderTextColor="#9A8A78"
          value={email}
          onChangeText={setEmail}
        />
      </View>
      <View style={authFormStyles.field}>
        <Text style={authFormStyles.label}>密码</Text>
        <TextInput
          style={authFormStyles.input}
          secureTextEntry
          placeholder="请输入密码"
          placeholderTextColor="#9A8A78"
          value={password}
          onChangeText={setPassword}
        />
      </View>
      {error ? <Text style={authFormStyles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={authFormStyles.primaryBtn}
        onPress={() => void onSubmit()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="登录"
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={authFormStyles.primaryBtnText}>登录</Text>
        )}
      </TouchableOpacity>
      <Pressable
        onPress={() => router.push('/(auth)/forgot-password')}
        style={authFormStyles.link}
      >
        <Text style={authFormStyles.linkText}>忘记密码？</Text>
      </Pressable>
      <Link href="/(auth)/register" asChild>
        <Pressable style={authFormStyles.link}>
          <Text style={authFormStyles.linkText}>没有账号？去注册</Text>
        </Pressable>
      </Link>
    </AuthScreenShell>
  );
}
