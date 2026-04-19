/**
 * components/error/ErrorState.tsx
 *
 * 统一错误展示组件
 * EARS-21: 接口错误展示用户可理解中文提示并避免崩溃
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

/** 错误类型分类 */
export type ErrorType = 'network' | 'timeout' | 'server' | 'unknown';

function classifyError(errorMessage: string | null): ErrorType {
  if (!errorMessage) return 'unknown';
  const msg = errorMessage.toLowerCase();
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('offline') || msg.includes('wifi')) {
    return 'network';
  }
  if (msg.includes('timeout') || msg.includes('超时') || msg.includes('60秒')) {
    return 'timeout';
  }
  if (msg.includes('http') || msg.includes('500') || msg.includes('server')) {
    return 'server';
  }
  return 'unknown';
}

function getErrorDisplay(errorMessage: string | null): { title: string; subtitle: string; icon: React.ReactNode } {
  const type = classifyError(errorMessage);
  switch (type) {
    case 'network':
      return {
        title: '网络连接失败',
        subtitle: '请检查网络后重试',
        icon: <WifiOff size={32} color={Colors.textMuted} />,
      };
    case 'timeout':
      return {
        title: '请求超时',
        subtitle: '服务器响应时间过长，请稍后重试',
        icon: <AlertCircle size={32} color={Colors.textMuted} />,
      };
    case 'server':
      return {
        title: '服务异常',
        subtitle: '服务器遇到问题，请稍后再试',
        icon: <AlertCircle size={32} color={Colors.textMuted} />,
      };
    default:
      return {
        title: '操作失败',
        subtitle: errorMessage ?? '请稍后重试',
        icon: <AlertCircle size={32} color={Colors.textMuted} />,
      };
  }
}

interface ErrorStateProps {
  errorMessage?: string | null;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({ errorMessage, onRetry, compact = false }: ErrorStateProps) {
  const { title, subtitle, icon } = getErrorDisplay(errorMessage ?? null);

  if (compact) {
    return (
      <View style={styles.compactWrap}>
        <Text style={styles.compactText}>{subtitle}</Text>
        {onRetry && (
          <TouchableOpacity onPress={onRetry} style={styles.compactRetry}>
            <RefreshCw size={14} color={Colors.primary} />
            <Text style={styles.compactRetryText}>重试</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle} numberOfLines={2}>
        {subtitle}
      </Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
          <RefreshCw size={16} color={Colors.white} />
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
    backgroundColor: Colors.background,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  retryText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  compactWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.cardMuted,
    borderRadius: 10,
  },
  compactText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textMuted,
  },
  compactRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactRetryText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
});
