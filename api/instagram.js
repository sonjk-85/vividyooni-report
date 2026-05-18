export default async function handler(req, res) {
  const { username, from, to } = req.query;
  // from, to 예시: 2026-05-08, 2026-05-18

  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  try {
    const runRes = await fetch(
      'https://api.apify.com/v2/acts/apify~instagram-post-scraper/runs',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.APIFY_API_TOKEN}`,
        },
        body: JSON.stringify({
          username: [username],
          resultsLimit: 100,
          ...(from && { onlyPostsNewerThan: from }),
        }),
      }
    );

    const runData = await runRes.json();
    const runId = runData.data?.id;

    if (!runId) throw new Error('Run 시작 실패: ' + JSON.stringify(runData));

    // 완료 대기 (최대 2분)
    let result = null;
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 5000));
      
      const statusRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}`,
        { headers: { 'Authorization': `Bearer ${process.env.APIFY_API_TOKEN}` } }
      );
      const statusData = await statusRes.json();
      
      if (statusData.data?.status === 'SUCCEEDED') {
        const datasetRes = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}/dataset/items`,
          { headers: { 'Authorization': `Bearer ${process.env.APIFY_API_TOKEN}` } }
        );
        result = await datasetRes.json();
        break;
      }

      if (statusData.data?.status === 'FAILED') {
        throw new Error('Actor 실행 실패');
      }
    }

    if (!result) throw new Error('타임아웃');

    // 날짜 필터링 (to 날짜 기준)
    let posts = result;
    if (to) {
      const toDate = new Date(to);
      posts = result.filter(p => new Date(p.timestamp) <= toDate);
    }

    // 필요한 데이터만 추출
    const filtered = posts.map(p => ({
      date: p.timestamp?.slice(0, 10),
      time: p.timestamp?.slice(11, 16),
      type: p.type,
      url: p.url,
      likes: p.likesCount,
      comments: p.commentsCount,
      views: p.videoViewCount || 0,
      caption: p.caption?.slice(0, 100),
      hashtags: p.hashtags,
    }));

    return res.status(200).json({ total: filtered.length, posts: filtered });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
