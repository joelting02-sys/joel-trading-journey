export async function onRequestPost(context) {
  const req = context.request;
  const targetUrl = req.headers.get('x-target-url');
  
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing X-Target-URL header' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.text();
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.get('authorization') || '',
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
