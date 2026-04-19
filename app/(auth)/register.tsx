import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { authFormStyles } from '@/components/auth/authFormStyles';
import { PASSWORD_RULES_HINT, validatePasswordForSignup } from '@/lib/auth/passwordPolicy';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!agreed) {
      setError('请先阅读并同意服务条款与隐私政策。');
      return;
    }
    const pwdErr = validatePasswordForSignup(password);
    if (pwdErr) {
      setError(pwdErr);
      return;
    }
    setBusy(true);
    try {
      const { error: err, needsEmailConfirmation } = await signUp(email, password);
      if (err) {
        setError(err);
        return;
      }
      if (needsEmailConfirmation) {
        router.replace({
          pathname: '/(auth)/pending-email',
          params: { email: email.trim() },
        });
        return;
      }
      router.replace('/(tabs)');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreenShell title="创建账号" subtitle="使用邮箱注册，数据将安全同步至云端。">
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
          placeholder="设置登录密码"
          placeholderTextColor="#9A8A78"
          value={password}
          onChangeText={setPassword}
        />
        <Text style={authFormStyles.hint}>{PASSWORD_RULES_HINT}</Text>
      </View>
      <TouchableOpacity
        style={styles.agreeRow}
        onPress={() => setAgreed((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
      >
        <Text style={styles.checkbox}>{agreed ? '☑' : '☐'}</Text>
        <Text style={styles.agreeText}>
          我已阅读并同意
          <Text style={styles.agreeLink}>《服务条款》</Text>与<Text style={styles.agreeLink}>《隐私政策》</Text>
        </Text>
      </TouchableOpacity>
      {error ? <Text style={authFormStyles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={authFormStyles.primaryBtn}
        onPress={() => void onSubmit()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="注册"
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={authFormStyles.primaryBtnText}>注册</Text>
        )}
      </TouchableOpacity>
      <Link href="/(auth)/login" asChild>
        <Pressable style={authFormStyles.link}>
          <Text style={authFormStyles.linkText}>已有账号？去登录</Text>
        </Pressable>
      </Link>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
  },
  checkbox: {
    fontSize: 18,
    lineHeight: 22,
    color: '#2C4A3E',
  },
  agreeText: {
    flex: 1,
    fontSize: 13,
    color: '#5C5040',
    lineHeight: 20,
  },
  agreeLink: {
    color: '#2C4A3E',
    fontWeight: '600',
  },
});
