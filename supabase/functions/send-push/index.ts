import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:koalaapp@example.com';
  if (!publicKey) return json({ error: 'Falta VAPID_PUBLIC_KEY' }, 500);

  // El navegador usa este endpoint para crear su PushSubscription.
  if (request.method === 'GET') return json({ publicKey });
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  if (!privateKey) return json({ error: 'Falta VAPID_PRIVATE_KEY' }, 500);

  try {
    const { to, title, body, data } = await request.json();
    if (to !== 'joel' && to !== 'princesa') return json({ error: 'Destino inválido' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: row, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint,p256dh,auth')
      .eq('identity', to)
      .maybeSingle();
    if (error) throw error;
    if (!row) return json({ delivered: false, reason: 'El destinatario todavía no activó notificaciones' }, 202);

    webpush.setVapidDetails(subject, publicKey, privateKey);
    await webpush.sendNotification({
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth }
    }, JSON.stringify({ title, body, data }));
    return json({ delivered: true });
  } catch (error) {
    console.error(error);
    const status = error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 500;
    return json({ error: error instanceof Error ? error.message : 'Error enviando push' }, status || 500);
  }
});
