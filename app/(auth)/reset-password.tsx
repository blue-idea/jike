import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { authFormStyles } from '@/components/auth/authFormStyles';
import { PASSWORD_RULES_HINT, validatePasswordForSignup } from '@/lib/auth/passwordPolicy';

export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    const pwdErr = validatePasswordForSignup(password);
    if (pwdErr) {
      setError(pwdErr);
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await updatePassword(password);
      if (err) {
        setError(err);
        return;
      }
      router.replace('/(auth)/login');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreenShell title="设置新密码" subtitle="密码更新后，请使用新密码重新登录。">
      <View style={authFormStyles.field}>
        <Text style={authFormStyles.label}>新密码</Text>
        <TextInput
          style={authFormStyles.input}
          secureTextEntry
          placeholder="输入新密码"
          placeholderTextColor="#9A8A78"
          value={password}
          onChangeText={setPassword}
        />
        <Text style={authFormStyles.hint}>{PASSWORD_RULES_HINT}</Text>
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
          <Text style={authFormStyles.primaryBtnText}>确认修改</Text>
        )}
      </TouchableOpacity>
    </AuthScreenShell>
  );
}
