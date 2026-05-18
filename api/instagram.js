export default async function handler(req, res) {
  const { username, from, to } = req.query;

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
          resultsLimit: 200,                          // 충분히 넉넉하게
          ...(from && { onlyPostsNewerThan: from }),  // 2026-05-08
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
      if (statusData.data?.status === 'FAILED') throw new Error('Actor 실행 실패');
    }

    if (!result) throw new Error('타임아웃');

    // to 날짜 필터링
    let posts = result;
    if (to) {
      const toDate = new Date(to + 'T23:59:59');
      posts = result.filter(p => new Date(p.timestamp) <= toDate);
    }

    const filtered = posts.map(p => ({
      date: p.timestamp?.slice(0, 10),
      time: p.timestamp?.slice(11, 16),
      type: p.type === 'Sidecar' ? '카드뉴스' : p.type === 'Video' ? '릴스' : p.type,
      url: p.url,
      likes: p.likesCount ?? 0,
      comments: p.commentsCount ?? 0,
      views: p.videoViewCount ?? 0,
      caption: p.caption?.slice(0, 80) ?? '',
    }));

    return res.status(200).json({ total: filtered.length, posts: filtered });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
