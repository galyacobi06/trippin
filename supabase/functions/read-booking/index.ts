// TRIPPIN helper: reads booking screenshots/PDF text with Google Gemini (free tier) and returns the details.
// Needs the secret GEMINI_API_KEY (Supabase → Edge Functions → Secrets).
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const S = { type: 'STRING' };
const schema = {
  type: 'OBJECT',
  properties: {
    kind: { type: 'STRING', enum: ['flight', 'train', 'hotel', 'car', 'event'] },
    title: S, date: S, time: S, endDate: S, endTime: S, from: S, to: S,
    flightOrCoach: S, seat: S, confirmation: S, address: S,
    price: { type: 'NUMBER' }, currency: S, travellers: S, note: S
  },
  required: ['kind', 'title']
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return json({ error: 'GEMINI_API_KEY is not set' }, 501);
  try {
    const { images = [], text = '', tripStart = '', tripEnd = '' } = await req.json();
    const prompt = `You read travel booking confirmations (screenshots from apps or emails, or text from a PDF). All of it belongs to ONE booking.
The trip runs from ${tripStart} to ${tripEnd}. Return the details as JSON:
- kind: flight, train, hotel, car (rental) or event (tickets for a concert, museum, etc.).
- title: short and in English, e.g. "Flight Paris → Tel Aviv", "Vienna → Salzburg", "Novotel Wien Hauptbahnhof", "Hertz car rental Zurich".
- date: YYYY-MM-DD of departure / check-in / pick-up / event. time: HH:MM 24h local time of departure / check-in / pick-up / start.
- endDate / endTime: arrival, check-out, return or end (if shown).
- from / to: for flights "City (IATA)" e.g. "Paris (CDG)", add ", Terminal X" to from if shown; for trains the station names.
- flightOrCoach: flight number (e.g. LY328) or train coach/car number. seat: seat(s).
- confirmation: the booking reference / PNR / confirmation number, exactly as written (careful with O vs 0).
- address: for hotels, car rentals and events.
- price: total amount paid or due as a number, currency: ISO code (EUR, CHF, USD, ILS).
- travellers: passenger / guest names if shown.
- note: one short English line with useful extras (airline, class, arrival time, gate/counters, pay at hotel, free cancellation deadline, baggage).
Apps in Hebrew read right to left: in "TLV ← CDG" the flight goes from CDG to TLV. Translate Hebrew to English. Leave a field empty if it isn't shown; never guess.`;
    const parts: unknown[] = [{ text: prompt }];
    for (const im of images.slice(0, 8)) parts.push({ inline_data: { mime_type: im.mime || 'image/jpeg', data: im.data } });
    if (text) parts.push({ text: 'Text from the file:\n' + String(text).slice(0, 30000) });
    const body = JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schema } });
    const models = [Deno.env.get('GEMINI_MODEL'), 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-2.5-flash'].filter(Boolean);
    let lastErr = '';
    for (const model of models) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body
      });
      const d = await r.json();
      if (!r.ok) { lastErr = d?.error?.message || String(r.status); if (r.status === 404 || r.status === 400) continue; return json({ error: lastErr }, r.status); }
      const out = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '{}';
      return json({ model, booking: JSON.parse(out) });
    }
    return json({ error: lastErr || 'No model available' }, 502);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 400);
  }
});
