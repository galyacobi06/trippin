// TRIPPIN helper: follows a short Google Maps link (maps.app.goo.gl/...) and returns the full link,
// which contains the place name and coordinates. Only Google links are followed.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const isGoogle = (host: string) => /(^|\.)(goo\.gl|google\.[a-z.]+)$/i.test(host);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { url } = await req.json();
    let current = new URL(String(url)).href;
    if (!isGoogle(new URL(current).hostname)) return json({ error: 'Only Google Maps links are supported' }, 400);
    for (let i = 0; i < 8; i++) {
      const res = await fetch(current, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'Accept-Language': 'en' } });
      const loc = res.headers.get('location');
      if (!loc) {
        // No more redirects: look for the place link inside the page as a last resort.
        if (res.status === 200 && !/\/maps\/place\//.test(current)) {
          const html = (await res.text()).slice(0, 400000);
          const m = html.match(/https:\/\/www\.google\.[a-z.]+\/maps\/place\/[^"'\\\s<]+/);
          if (m) current = m[0];
          const title = html.match(/<meta (?:content="([^"]+)" (?:itemprop|property)="(?:og:)?title"|(?:itemprop|property)="(?:og:)?title" content="([^"]+)")/);
          if (title) return json({ url: current, title: (title[1] || title[2] || '').replace(/&amp;/g, '&') });
        }
        break;
      }
      let next = new URL(loc, current);
      // Skip Google's cookie-consent page if it appears.
      if (/consent\.google/.test(next.hostname) && next.searchParams.get('continue')) next = new URL(next.searchParams.get('continue')!);
      if (!isGoogle(next.hostname)) break;
      current = next.href;
      if (/\/maps\/place\/|[?&]q=|@-?\d+\.\d+,-?\d+\.\d+/.test(current)) break;
    }
    return json({ url: current });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 400);
  }
});
