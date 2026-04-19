import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { authFormStyles } from '@/components/auth/authFormStyles';

export default function ForgotPasswordScreen() {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await resetPasswordForEmail(email);
      if (err) {
        setError(err);
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreenShell
      title="找回密码"
      subtitle={done ? '若邮箱已注册，您将收到重置邮件，请按邮件说明操作。' : '我们将向您的注册邮箱发送重置链接。'}
    >
      {!done ? (
        <>
          <View style={authFormStyles.field}>
            <Text style={authFormStyles.label}>注册邮箱</Text>
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
          {error ? <Text style={authFormStyles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={authFormStyles.primaryBtn}
            onPress={() => void onSubmit()}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={authFormStyles.primaryBtnText}>发送重置邮件</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <Text style={authFormStyles.hint}>
          重置完成后需重新登录。若未收到邮件，请检查垃圾箱或稍后再试。
        </Text>
      )}
      <Pressable onPress={() => router.back()} style={authFormStyles.link}>
        <Text style={authFormStyles.linkText}>返回登录</Text>
      </Pressable>
    </AuthScreenShell>
  );
}
