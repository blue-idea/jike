import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

/** 深度链接入口占位；实际 token 解析在 AuthProvider 的 Linking 监听中完成。 */
export default function AuthCallbackScreen() {
  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>正在处理验证链接…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: 16,
    paddingHorizontal: 24,
  },
  text: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
