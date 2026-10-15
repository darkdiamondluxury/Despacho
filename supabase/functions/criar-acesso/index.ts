// Edge Function "criar-acesso" — corre nos servidores do Supabase, não no telemóvel.
//
// Porquê aqui? Criar contas em nome de outra pessoa exige a chave secreta (service_role).
// Essa chave nunca pode ir para a app. O Supabase entrega-a automaticamente a esta função
// (variável SUPABASE_SERVICE_ROLE_KEY), por isso não tens de a copiar para lado nenhum.
//
// Só um ADMIN da empresa pode usar esta função. Ações:
//   list      -> lista a equipa com emails
//   create    -> cria conta (email + palavra-passe), já confirmada, e liga-a à empresa (e ao driver)
//   reset     -> define nova palavra-passe
//   set_active-> ativa / desativa um acesso (desativado não vê nada)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ROLES = ['admin', 'office', 'driver'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1) Quem está a pedir? (pelo login que a app envia)
    const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: 'Sem sessão iniciada.' }, 401);

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: me } = await admin.from('profiles').select('company_id, role, active').eq('id', user.id).maybeSingle();
    if (!me || !me.active || me.role !== 'admin') return json({ error: 'Só um administrador pode gerir acessos.' }, 403);
    const company = me.company_id as string;

    const b = await req.json().catch(() => ({}));

    // Confirma que a pessoa alvo é da mesma empresa
    async function sameCompany(userId: string) {
      const { data } = await admin.from('profiles').select('id').eq('id', userId).eq('company_id', company).maybeSingle();
      return !!data;
    }

    switch (b.action) {
      case 'list': {
        const { data: team } = await admin.from('profiles')
          .select('id, full_name, role, can_money, can_track, active').eq('company_id', company).order('full_name');
        const { data: drv } = await admin.from('drivers').select('id, user_id').eq('company_id', company).not('user_id', 'is', null);
        const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const emails = new Map(users.users.map((u) => [u.id, u.email]));
        const drvBy = new Map((drv ?? []).map((d) => [d.user_id, d.id]));
        return json({ team: (team ?? []).map((p) => ({ ...p, email: emails.get(p.id) ?? null, driver_id: drvBy.get(p.id) ?? null })) });
      }

      case 'create': {
        const email = String(b.email ?? '').trim().toLowerCase();
        const password = String(b.password ?? '');
        const role = String(b.role ?? 'driver');
        const fullName = String(b.full_name ?? '').trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Email inválido.' }, 400);
        if (password.length < 6) return json({ error: 'A palavra-passe tem de ter pelo menos 6 caracteres.' }, 400);
        if (!ROLES.includes(role)) return json({ error: 'Papel inválido.' }, 400);

        let driverId: string | null = null;
        if (role === 'driver') {
          const { data: d } = await admin.from('drivers').select('id, user_id, name')
            .eq('id', b.driver_id ?? '').eq('company_id', company).maybeSingle();
          if (!d) return json({ error: 'Escolhe o driver na Frota.' }, 400);
          if (d.user_id) return json({ error: 'Este driver já tem acesso.' }, 400);
          driverId = d.id;
        }

        const { data: created, error: e1 } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (e1 || !created.user) {
          const m = e1?.message ?? '';
          return json({ error: m.includes('already') ? 'Já existe uma conta com este email.' : m }, 400);
        }
        const uid = created.user.id;
        const { error: e2 } = await admin.from('profiles').insert({
          id: uid, company_id: company, full_name: fullName, role,
          can_money: role === 'admin' ? true : !!b.can_money,
          can_track: role === 'admin' ? true : !!b.can_track,
        });
        if (e2) { await admin.auth.admin.deleteUser(uid); return json({ error: e2.message }, 400); }
        if (driverId) await admin.from('drivers').update({ user_id: uid }).eq('id', driverId);
        await admin.from('audit_log').insert({ company_id: company, by_user: user.id, text: `Criou acesso ${role}: ${email}` });
        return json({ ok: true, user_id: uid });
      }

      case 'reset': {
        if (!(await sameCompany(b.user_id))) return json({ error: 'Pessoa não encontrada.' }, 404);
        if (String(b.password ?? '').length < 6) return json({ error: 'A palavra-passe tem de ter pelo menos 6 caracteres.' }, 400);
        const { error } = await admin.auth.admin.updateUserById(b.user_id, { password: b.password });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case 'set_active': {
        if (b.user_id === user.id) return json({ error: 'Não podes desativar o teu próprio acesso.' }, 400);
        if (!(await sameCompany(b.user_id))) return json({ error: 'Pessoa não encontrada.' }, 404);
        await admin.from('profiles').update({ active: !!b.active }).eq('id', b.user_id);
        // Desativado: bloqueia também o login (deixa de conseguir renovar a sessão)
        await admin.auth.admin.updateUserById(b.user_id, { ban_duration: b.active ? 'none' : '876000h' });
        return json({ ok: true });
      }

      default:
        return json({ error: 'Ação desconhecida.' }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
