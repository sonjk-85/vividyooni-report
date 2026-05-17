export default async function handler(req, res) {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  try {
    const runRes = await fetch(
      'https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.APIFY_API_TOKEN}`,
        },
        body: JSON.stringify({
          usernames: [username],
        }),
      }
    );

    const runData = await runRes.json();
    const runId = runData.data?.id;

    if (!runId) throw new Error('Run 시작 실패');

    let result = null;
    for (let i = 0; i < 12; i++) {
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
    }

    if (!result) throw new Error('타임아웃');

    return res.status(200).json(result[0]);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
