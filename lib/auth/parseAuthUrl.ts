export type ParsedAuthRedirect = {
  access_token: string | null;
  refresh_token: string | null;
  type: string | null;
};

/** 解析 Supabase 邮件链接回跳中的 fragment 或 query（不记录日志）。 */
export function parseAuthRedirectUrl(url: string): ParsedAuthRedirect {
  const hashIdx = url.indexOf('#');
  const qIdx = url.indexOf('?');
  let fragment = '';
  let query = '';
  if (hashIdx >= 0) fragment = url.slice(hashIdx + 1);
  if (qIdx >= 0) {
    const end = hashIdx >= 0 ? hashIdx : url.length;
    query = url.slice(qIdx + 1, end);
  }
  const params = new URLSearchParams(fragment || query);
  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    type: params.get('type'),
  };
}
