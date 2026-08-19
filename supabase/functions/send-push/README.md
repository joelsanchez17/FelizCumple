# send-push

La función necesita estos secretos en Supabase:

```sh
supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:tu-email@example.com"
supabase functions deploy send-push
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son provistos automáticamente por Supabase Edge Functions.
