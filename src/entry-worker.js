export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Intercept requests to /api/ai-proxy
    if (url.pathname === '/api/ai-proxy' && request.method === 'POST') {
      const targetUrl = request.headers.get('x-target-url');
      if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'Missing X-Target-URL header' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        const body = await request.text();
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': request.headers.get('authorization') || '',
          },
          body: body,
        });

        const responseText = await response.text();

        return new Response(responseText, {
          status: response.status,
          headers: {
            'Content-Type': response.headers.get('content-type') || 'application/json',
          },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: `Proxy error: ${err.message || err}` }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Default to serving static assets
    return env.ASSETS.fetch(request);
  }
};
