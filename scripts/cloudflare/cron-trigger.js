export default {
  async scheduled(event, env, ctx) {
    const laHour = parseInt(
      new Date().toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        hour12: false,
      })
    );

    if (laHour !== 0) {
      console.log(`Skipping: LA time is hour ${laHour}, not midnight`);
      return;
    }

    const res = await fetch(
      'https://api.github.com/repos/myi39/sky-shards/actions/workflows/daily-screenshot.yml/dispatches',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'sky-shards-cron-worker',
        },
        body: JSON.stringify({ ref: 'main', inputs: { target: 'prod' } }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API error: ${res.status} ${body}`);
    }

    console.log('workflow_dispatch triggered successfully');
  },
};
