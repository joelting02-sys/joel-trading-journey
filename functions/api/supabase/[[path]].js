export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // Reconstruct target URL pointing to the actual Supabase project
  const supabaseUrl = "https://imemwbgtxnkfodncfgal.supabase.co";
  const path = url.pathname.replace(/^\/api\/supabase/, "");
  const targetUrl = `${supabaseUrl}${path}${url.search}`;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, Prefer, Range, If-None-Match',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Location, ETag',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Copy request headers
    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
      if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'origin' && key.toLowerCase() !== 'referer') {
        headers.set(key, value);
      }
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'follow',
    });

    // Copy response headers and add CORS
    const responseHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      responseHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Supabase Proxy error: ${err.message || err}` }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}
