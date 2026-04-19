import { Text, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { authFormStyles } from '@/components/auth/authFormStyles';

export default function PendingEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();

  return (
    <AuthScreenShell
      title="请验证邮箱"
      subtitle={
        email
          ? `我们已向 ${email} 发送验证邮件，请点击邮件内链接完成验证。`
          : '请前往邮箱点击验证链接，完成验证后即可登录。'
      }
    >
      <Text style={authFormStyles.hint}>
        若收件箱没有邮件，请稍等几分钟或检查垃圾箱。验证完成后返回登录即可。
      </Text>
      <Pressable onPress={() => router.replace('/(auth)/login')} style={authFormStyles.link}>
        <Text style={authFormStyles.linkText}>返回登录</Text>
      </Pressable>
    </AuthScreenShell>
  );
}
