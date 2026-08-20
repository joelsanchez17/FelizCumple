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
  const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:joelsanchezdeutsch@gmail.com';
  if (!publicKey) return json({ error: 'Falta VAPID_PUBLIC_KEY' }, 500);

  // El navegador usa este endpoint para crear su PushSubscription.
  if (request.method === 'GET') return json({ publicKey });
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  if (!privateKey) return json({ error: 'Falta VAPID_PRIVATE_KEY' }, 500);

  try {
    const payload = await request.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (payload.action === 'subscribe') {
      const { identity, subscription } = payload;
      if ((identity !== 'joel' && identity !== 'princesa') ||
          !subscription?.endpoint || !subscription?.p256dh || !subscription?.auth) {
        return json({ error: 'Suscripción inválida' }, 400);
      }
      // Un endpoint solo puede pertenecer a una identidad, incluso después de cambiar perfil.
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint).neq('identity', identity);
      const { error } = await supabase.from('push_subscriptions').upsert({
        identity,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        updated_at: new Date().toISOString()
      }, { onConflict: 'endpoint' });
      if (error) throw error;
      return json({ subscribed: true, identity });
    }

    if (payload.action === 'get-drawings') {
      const identity = payload.identity;
      if (identity !== 'joel' && identity !== 'princesa') return json({ error: 'Identidad inválida' }, 400);
      const sender = identity === 'joel' ? 'princesa' : 'joel';
      const { data: drawings, error } = await supabase
        .from('drawings')
        .select('id,data,date,created_at')
        .eq('from_identity', sender)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return json({ drawings: drawings || [] });
    }

    const { to, title, body, data, drawing } = payload;
    if (to !== 'joel' && to !== 'princesa') return json({ error: 'Destino inválido' }, 400);
    if (drawing) {
      if ((drawing.from_identity !== 'joel' && drawing.from_identity !== 'princesa') || !drawing.data) {
        return json({ error: 'Dibujo inválido' }, 400);
      }
      const { error: drawingError } = await supabase.from('drawings').insert(drawing);
      if (drawingError) throw drawingError;
    }
    const { data: rows, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint,p256dh,auth')
      .eq('identity', to);
    if (error) throw error;
    if (!rows?.length) return json({ delivered: false, reason: 'El destinatario todavía no activó notificaciones' }, 202);

    webpush.setVapidDetails(subject, publicKey, privateKey);
    let delivered = 0;
    const expired: string[] = [];
    await Promise.all(rows.map(async row => {
      try {
        await webpush.sendNotification({
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth }
        }, JSON.stringify({ title, body, data }));
        delivered++;
      } catch (pushError) {
        const status = pushError && typeof pushError === 'object' && 'statusCode' in pushError
          ? Number(pushError.statusCode) : 0;
        if (status === 404 || status === 410) expired.push(row.endpoint);
        else throw pushError;
      }
    }));
    if (expired.length) await supabase.from('push_subscriptions').delete().in('endpoint', expired);
    return json({ delivered: delivered > 0, devices: delivered, expired: expired.length });
  } catch (error) {
    console.error(error);
    const status = error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 500;
    return json({ error: error instanceof Error ? error.message : 'Error enviando push' }, status || 500);
  }
});
