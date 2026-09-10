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
  const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.invalid';
  if (!publicKey) return json({ error: 'Falta VAPID_PUBLIC_KEY' }, 500);

  // El navegador usa este endpoint para crear su PushSubscription.
  if (request.method === 'GET') return json({ publicKey });
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  if (!privateKey) return json({ error: 'Falta VAPID_PRIVATE_KEY' }, 500);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sesión requerida' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const authClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data:authData, error:authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'Sesión inválida' }, 401);

    const supabase = createClient(
      url,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data:member, error:memberError } = await supabase
      .from('house_members')
      .select('identity')
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (memberError) throw memberError;
    const metadataIdentity = authData.user.user_metadata?.house_identity;
    const caller = member?.identity || metadataIdentity;
    if (caller !== 'joel' && caller !== 'princesa') return json({ error: 'Cuenta sin membresía' }, 403);

    const payload = await request.json();

    if (payload.action === 'subscribe') {
      const { subscription } = payload;
      if (!subscription?.endpoint || !subscription?.p256dh || !subscription?.auth) {
        return json({ error: 'Suscripción inválida' }, 400);
      }
      // Un endpoint solo puede pertenecer a una identidad, incluso después de cambiar perfil.
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint).neq('identity', caller);
      const { error } = await supabase.from('push_subscriptions').upsert({
        identity: caller,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        updated_at: new Date().toISOString()
      }, { onConflict: 'endpoint' });
      if (error) throw error;
      return json({ subscribed: true, identity:caller });
    }

    if (payload.action === 'get-drawings') {
      const sender = caller === 'joel' ? 'princesa' : 'joel';
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
    const partner = caller === 'joel' ? 'princesa' : 'joel';
    if (to !== partner) return json({ error: 'Destino inválido' }, 400);
    if (typeof title !== 'string' || !title.trim() || title.length > 120 ||
        typeof body !== 'string' || !body.trim() || body.length > 400) {
      return json({ error: 'Notificación inválida' }, 400);
    }
    if (drawing) {
      if (drawing.from_identity !== caller || typeof drawing.data !== 'string' ||
          !drawing.data.startsWith('data:image/png;base64,') || drawing.data.length > 2_500_000) {
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
    const status = error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 500;
    console.error('send-push failed', status || 500);
    return json({ error: error instanceof Error ? error.message : 'Error enviando push' }, status || 500);
  }
});
