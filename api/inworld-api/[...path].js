export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const url = new URL(request.url);
  // Extract the path after /api/inworld-api/
  const pathMatch = url.pathname.match(/\/api\/inworld-api\/(.+)/);
  const path = pathMatch ? pathMatch[1] : '';

  const targetUrl = `https://api.inworld.ai/${path}`;

  console.log('Proxying to:', targetUrl);

  // Forward the request to Inworld API
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      'Authorization': request.headers.get('Authorization'),
      'Content-Type': request.headers.get('Content-Type') || 'application/json',
    },
    body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined,
  });

  // Return the response
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
