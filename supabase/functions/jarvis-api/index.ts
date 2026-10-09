import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('EONIS_WEB_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sign-in required.' }, 401);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userResult, error: authError } = await supabase.auth.getUser();
  if (authError || !userResult.user) return json({ error: 'Invalid session.' }, 401);
  const path = new URL(request.url).pathname.split('/').filter(Boolean).at(-1);

  if (request.method === 'GET' && path === 'tasks') {
    const { data, error } = await supabase.from('tasks').select('id,title,details,status,priority,due_at,duration_minutes,category,tags,updated_at')
      .eq('user_id', userResult.user.id).is('deleted_at', null).order('due_at', { nullsFirst: false });
    if (error) return json({ error: 'Could not load tasks.' }, 500);
    return json({ data });
  }

  if (request.method === 'POST' && path === 'tasks') {
    let input: Record<string, unknown>;
    try { input = await request.json(); } catch { return json({ error: 'Expected JSON.' }, 400); }
    const title = typeof input.title === 'string' ? input.title.trim().slice(0, 500) : '';
    if (!title) return json({ error: 'A task title is required.' }, 400);
    const { data, error } = await supabase.from('tasks').insert({
      user_id: userResult.user.id, title,
      details: typeof input.details === 'string' ? input.details.slice(0, 5000) : '',
      priority: ['low', 'medium', 'high', 'urgent'].includes(String(input.priority)) ? input.priority : 'medium',
      due_at: typeof input.due_at === 'string' ? input.due_at : null,
    }).select('id,title,status,priority,due_at,created_at').single();
    if (error) return json({ error: 'Could not create task.' }, 400);
    return json({ data }, 201);
  }

  return json({ error: 'Route not found.' }, 404);
});
