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
    // 인증 코드로 Access Token 발급
    const tokenRes = await fetch(
      `https://vividyn.cafe24api.com/api/v2/oauth/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'https://vividyooni-report.vercel.app/api/auth/callback',
          client_id: process.env.CAFE24_CLIENT_ID,
          client_secret: process.env.CAFE24_CLIENT_SECRET,
        })
      }
    );

    const tokenData = await tokenRes.json();

    // Supabase에 토큰 저장
    await supabase.from('cafe24_tokens').upsert({
      id: 1,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    });

    return res.status(200).send('✅ 인증 완료! 이 창을 닫으세요.');
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
