import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  try {
    // 카페24 Access Token 발급
    const tokenRes = await fetch(
      'https://vividyn.cafe24api.com/api/v2/oauth/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(
            `${process.env.CAFE24_CLIENT_ID}:${process.env.CAFE24_CLIENT_SECRET}`
          ).toString('base64'),
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'https://vividyooni-report.vercel.app/api/auth/callback',
        }),
      }
    );

    const tokenData = await tokenRes.json();

    // 토큰 발급 실패 체크
    if (!tokenData.access_token) {
      console.error('Token error:', tokenData);
      return res.status(400).json({ error: '토큰 발급 실패', detail: tokenData });
    }

    // Supabase에 토큰 저장
    const { error } = await supabase.from('cafe24_tokens').upsert({
      mall_id: 'vividyn',
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'mall_id' });

    if (error) throw error;

    return res.status(200).send('✅ 인증 완료! 이 창을 닫으세요.');

  } catch (e) {
    console.error('OAuth error:', e);
    return res.status(500).json({ error: e.message });
  }
}
