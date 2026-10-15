-- =====================================================================
-- Despacho · estrutura inicial da base de dados (Supabase / PostgreSQL)
--
-- Como ler este ficheiro:
--   * Cada "create table" é uma tabela, como uma folha de Excel com colunas fixas.
--   * Todas as tabelas têm company_id: cada linha pertence a uma empresa.
--     Assim, no futuro, várias empresas podem usar a mesma app sem verem
--     os dados umas das outras (é isto que permite vender por subscrição).
--   * "RLS" (Row Level Security) são as regras que o próprio servidor aplica:
--     mesmo que alguém tente aceder diretamente, só recebe as linhas a que
--     tem direito. Um driver só vê os serviços dele; só o chefe vê valores
--     e localizações.
--   * Os valores (preços, custos, margens) estão numa tabela à parte
--     (service_money), para os drivers nunca os receberem.
--   * As gorjetas ficam numa tabela que só o próprio driver consegue ler.
--
-- Pode ser corrido de uma vez no SQL Editor da Supabase.
-- =====================================================================

-- ---------- tipos fixos ----------
create type public.user_role as enum ('admin','office','driver');
create type public.service_status as enum
  ('pendente','enviado','aceite','a_caminho','a_bordo','concluido','no_show','recusado','cancelado','entregue');

-- ---------- empresas e pessoas ----------
create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  nif         text,
  address     text,
  phone       text,
  email       text,
  logo_path   text,
  settings    jsonb not null default '{}'::jsonb,   -- IVA, prazos, canais, durações por omissão, etc.
  created_at  timestamptz not null default now()
);

-- Uma linha por pessoa com conta (ligada ao login da Supabase).
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  full_name   text not null default '',
  phone       text,
  role        public.user_role not null default 'driver',
  can_money   boolean not null default false,   -- vê valores e finanças (o admin vê sempre)
  can_track   boolean not null default false,   -- vê a localização dos drivers (o admin vê sempre)
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- funções de apoio às regras ----------
-- "security definer" quer dizer que correm com permissões do sistema,
-- para conseguirem ler o perfil sem entrar num ciclo de regras.
create or replace function public.my_company() returns uuid
language sql stable security definer set search_path = public as
$$ select company_id from public.profiles where id = auth.uid() and active $$;

create or replace function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() and active $$;

create or replace function public.is_office() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('admin','office') from public.profiles where id = auth.uid() and active), false) $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'admin' from public.profiles where id = auth.uid() and active), false) $$;

create or replace function public.can_money() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'admin' or (role = 'office' and can_money) from public.profiles where id = auth.uid() and active), false) $$;

create or replace function public.can_track() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'admin' or (role = 'office' and can_track) from public.profiles where id = auth.uid() and active), false) $$;

-- ---------- frota e parceiros ----------
create table public.vehicles (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  name         text not null,
  plate        text,
  category     text not null default 'Carro',      -- Carro, Carro Executive, Van, Van VIP
  seats        int,
  bags         int,
  km           int,
  available    boolean not null default true,
  service_types text[],                            -- null = serve para todos os tipos
  docs         jsonb not null default '[]'::jsonb, -- seguros, inspeção... com validade
  blocks       jsonb not null default '[]'::jsonb, -- períodos de manutenção
  removed      boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.drivers (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  user_id         uuid unique references public.profiles(id) on delete set null, -- a conta do driver, quando tiver
  name            text not null,
  phone           text,
  tags            text[] not null default '{}',
  vehicle_ids     uuid[],          -- null = conduz todos
  service_types   text[],          -- null = faz todos os tipos
  home_vehicle_id uuid references public.vehicles(id) on delete set null,
  docs            jsonb not null default '[]'::jsonb,
  available       boolean not null default true,
  removed         boolean not null default false,
  created_at      timestamptz not null default now()
);

create or replace function public.my_driver_id() returns uuid
language sql stable security definer set search_path = public as
$$ select id from public.drivers where user_id = auth.uid() and not removed $$;

create table public.partners (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  kind        text not null default 'partner' check (kind in ('partner','app')),
  legal_name  text,
  nif         text,
  phone       text,
  email       text,
  address     text,
  terms_days  int not null default 30,
  gives       boolean not null default true,   -- entrega-nos serviços
  does        boolean not null default false,  -- faz serviços para nós
  notes       text,
  removed     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.service_types (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  name_en     text,
  duration_min int not null default 60,
  position    int not null default 0,
  unique (company_id, name)
);

create table public.pay_rules (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  driver_id   uuid references public.drivers(id) on delete cascade,
  service_type text,
  origin      text,          -- 'direct' ou id do parceiro
  vehicle_category text,
  amount      numeric(10,2) not null,
  valid_from  date,
  created_at  timestamptz not null default now()
);

-- ---------- serviços ----------
create table public.services (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  ref             text,
  partner_ref     text,
  date            date not null,
  time            time,
  end_time        time,
  wait_min        int,
  service_type    text,
  vehicle_type    text,
  pickup          text,
  stops           text[] not null default '{}',
  dropoff         text,
  flight          text,
  client_name     text,
  client_phone    text,
  client_email    text,
  client_type     text,
  pax             int,
  checked_bags    int,
  cabin_bags      int,
  booster         boolean not null default false,
  notes           text,                 -- para o driver
  requirements    text,
  internal_notes  text,                 -- só escritório
  channel         text,
  source          text not null default 'manual',  -- manual, print, foto, texto
  origin          text not null default 'direct' check (origin in ('direct','partner')),
  origin_partner_id uuid references public.partners(id),
  bill_name       text,
  bill_nif        text,
  exec            text not null default 'int' check (exec in ('int','ext')),
  exec_partner_id uuid references public.partners(id),
  driver_id       uuid references public.drivers(id),
  vehicle_id      uuid references public.vehicles(id),
  status          public.service_status not null default 'pendente',
  prev_status     public.service_status,
  sent_at         timestamptz,
  seen_by_driver  boolean not null default false,
  changed_at      timestamptz,
  decline_reason  text,
  declined_by     uuid references public.drivers(id),
  arrived_at      timestamptz,
  show_price      boolean not null default false,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index services_company_date on public.services (company_id, date);
create index services_driver_date  on public.services (driver_id, date);

-- Valores de cada serviço: só para quem pode ver finanças.
create table public.service_money (
  service_id      uuid primary key references public.services(id) on delete cascade,
  company_id      uuid not null references public.companies(id) on delete cascade,
  price           numeric(10,2),
  price_vat_mode  text not null default 'sem' check (price_vat_mode in ('sem','com')),
  vat_rate        numeric(5,2) not null default 6,
  cost            numeric(10,2),
  cost_vat_mode   text not null default 'sem' check (cost_vat_mode in ('sem','com')),
  cost_rate       numeric(5,2) not null default 6,
  cost_deductible boolean not null default true,
  driver_pay      numeric(10,2),       -- vazio = usa as regras de valores
  cancel_fee      numeric(10,2),
  cancel_cost     numeric(10,2),
  invoice_no      text,
  invoice_date    date,
  updated_at      timestamptz not null default now()
);

-- Recebimentos (in) e pagamentos a parceiros (out), por serviço.
create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  service_id  uuid not null references public.services(id) on delete cascade,
  direction   text not null check (direction in ('in','out')),
  date        date not null,
  amount      numeric(10,2) not null,
  method      text,
  reference   text,
  batch       text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create table public.driver_payments (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  driver_id   uuid not null references public.drivers(id) on delete cascade,
  date        date not null,
  amount      numeric(10,2) not null,
  method      text,
  note        text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  service_id  uuid not null references public.services(id) on delete cascade,
  driver_id   uuid references public.drivers(id),
  type        text not null,
  amount      numeric(10,2) not null,
  note        text,
  photo_path  text,
  paid_by     text not null default 'driver' check (paid_by in ('driver','empresa')),
  in_partner  boolean not null default false,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create table public.general_expenses (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  date        date not null,
  category    text not null,
  amount      numeric(10,2) not null,
  note        text,
  vehicle_id  uuid references public.vehicles(id),
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- Histórico de cada serviço: cada mudança de estado com hora e local.
-- É também a matéria-prima para estatísticas e previsões no futuro.
create table public.service_events (
  id          bigint generated always as identity primary key,
  company_id  uuid not null references public.companies(id) on delete cascade,
  service_id  uuid not null references public.services(id) on delete cascade,
  kind        text not null,          -- criado, enviado, aceite, a_caminho, chegou, a_bordo, concluido...
  note        text,
  money       boolean not null default false,
  lat         double precision,
  lng         double precision,
  accuracy_m  int,
  by_user     uuid references public.profiles(id),
  at          timestamptz not null default now()
);
create index service_events_service on public.service_events (service_id, at);

-- Provas e ocorrências: fotografias e notas com hora e GPS.
create table public.evidence (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  service_id  uuid not null references public.services(id) on delete cascade,
  kind        text not null,          -- chegada, no_show, atraso, incidente, cliente, escritorio, outro
  note        text,
  photo_path  text,
  lat         double precision,
  lng         double precision,
  accuracy_m  int,
  status_at   text,
  by_user     uuid references public.profiles(id),
  at          timestamptz not null default now()
);
create index evidence_service on public.evidence (service_id, at);

-- Posições dos drivers, só durante um serviço em curso.
create table public.locations (
  id          bigint generated always as identity primary key,
  company_id  uuid not null references public.companies(id) on delete cascade,
  driver_id   uuid not null references public.drivers(id) on delete cascade,
  service_id  uuid references public.services(id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  accuracy_m  int,
  speed_ms    real,
  heading     real,
  at          timestamptz not null default now()
);
create index locations_driver_at on public.locations (driver_id, at desc);
create index locations_service   on public.locations (service_id, at);

create table public.unavailability (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  driver_id   uuid not null references public.drivers(id) on delete cascade,
  date        date not null,
  from_time   time,
  to_time     time,
  note        text,
  created_at  timestamptz not null default now()
);

create table public.notices (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  text          text not null,
  to_driver_id  uuid references public.drivers(id) on delete cascade,  -- null = todos
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);
create table public.notice_reads (
  notice_id   uuid not null references public.notices(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  read_at     timestamptz not null default now(),
  primary key (notice_id, user_id)
);

-- Gorjetas: só o próprio driver as vê, na app ninguém mais.
create table public.driver_tips (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  service_id  uuid not null references public.services(id) on delete cascade,
  amount      numeric(10,2) not null,
  primary key (user_id, service_id)
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  company_id  uuid not null references public.companies(id) on delete cascade,
  by_user     uuid references public.profiles(id),
  text        text not null,
  money       boolean not null default false,
  at          timestamptz not null default now()
);

-- ---------- datas de alteração automáticas ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at := now(); return new; end $$;
create trigger services_touch before update on public.services for each row execute function public.touch_updated_at();
create trigger money_touch    before update on public.service_money for each row execute function public.touch_updated_at();

-- =====================================================================
-- Regras de acesso (RLS)
-- =====================================================================
alter table public.companies        enable row level security;
alter table public.profiles         enable row level security;
alter table public.vehicles         enable row level security;
alter table public.drivers          enable row level security;
alter table public.partners         enable row level security;
alter table public.service_types    enable row level security;
alter table public.pay_rules        enable row level security;
alter table public.services         enable row level security;
alter table public.service_money    enable row level security;
alter table public.payments         enable row level security;
alter table public.driver_payments  enable row level security;
alter table public.expenses         enable row level security;
alter table public.general_expenses enable row level security;
alter table public.service_events   enable row level security;
alter table public.evidence         enable row level security;
alter table public.locations        enable row level security;
alter table public.unavailability   enable row level security;
alter table public.notices          enable row level security;
alter table public.notice_reads     enable row level security;
alter table public.driver_tips      enable row level security;
alter table public.audit_log        enable row level security;

-- Só utilizadores com sessão iniciada falam com a base de dados.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- empresa
create policy "ver a minha empresa" on public.companies for select using (id = public.my_company());
create policy "admin altera a empresa" on public.companies for update using (id = public.my_company() and public.is_admin());

-- perfis
create policy "ver o meu perfil" on public.profiles for select using (id = auth.uid());
create policy "escritório vê a equipa" on public.profiles for select using (company_id = public.my_company() and public.is_office());
create policy "admin gere a equipa" on public.profiles for all using (company_id = public.my_company() and public.is_admin()) with check (company_id = public.my_company());

-- frota, parceiros, tipos e valores: o escritório gere tudo
create policy "escritório gere veículos"  on public.vehicles      for all using (company_id = public.my_company() and public.is_office()) with check (company_id = public.my_company());
create policy "escritório gere drivers"   on public.drivers       for all using (company_id = public.my_company() and public.is_office()) with check (company_id = public.my_company());
create policy "escritório gere parceiros" on public.partners      for all using (company_id = public.my_company() and public.is_office()) with check (company_id = public.my_company());
create policy "escritório gere tipos"     on public.service_types for all using (company_id = public.my_company() and public.is_office()) with check (company_id = public.my_company());
create policy "finanças gerem valores dos drivers" on public.pay_rules for all using (company_id = public.my_company() and public.can_money()) with check (company_id = public.my_company());
-- o driver vê a sua ficha, os veículos da empresa e os tipos de serviço
create policy "driver vê a sua ficha"   on public.drivers       for select using (user_id = auth.uid());
create policy "driver vê os veículos"   on public.vehicles      for select using (company_id = public.my_company());
create policy "driver vê os tipos"      on public.service_types for select using (company_id = public.my_company());

-- serviços
create policy "escritório gere serviços" on public.services for all using (company_id = public.my_company() and public.is_office()) with check (company_id = public.my_company());
-- o driver vê só os seus, depois de enviados; altera-os só pela função driver_set_status
create policy "driver vê os seus serviços" on public.services for select using (
  driver_id = public.my_driver_id()
  and sent_at is not null
  and status in ('enviado','aceite','a_caminho','a_bordo','concluido','no_show','cancelado')
);

-- valores: só finanças
create policy "finanças veem valores"   on public.service_money    for all using (company_id = public.my_company() and public.can_money()) with check (company_id = public.my_company());
create policy "finanças veem pagamentos" on public.payments        for all using (company_id = public.my_company() and public.can_money()) with check (company_id = public.my_company());
create policy "finanças pagam drivers"  on public.driver_payments  for all using (company_id = public.my_company() and public.can_money()) with check (company_id = public.my_company());
create policy "driver vê o que recebeu" on public.driver_payments  for select using (driver_id = public.my_driver_id());
create policy "finanças despesas gerais" on public.general_expenses for all using (company_id = public.my_company() and public.can_money()) with check (company_id = public.my_company());

-- despesas dos serviços
create policy "escritório vê despesas" on public.expenses for all using (company_id = public.my_company() and public.is_office()) with check (company_id = public.my_company());
create policy "driver regista despesas" on public.expenses for insert with check (
  company_id = public.my_company() and driver_id = public.my_driver_id()
  and exists (select 1 from public.services s where s.id = service_id and s.driver_id = public.my_driver_id())
);
create policy "driver vê as suas despesas" on public.expenses for select using (driver_id = public.my_driver_id());
create policy "driver apaga as suas despesas" on public.expenses for delete using (driver_id = public.my_driver_id() and created_by = auth.uid());

-- histórico
create policy "escritório vê histórico" on public.service_events for select using (company_id = public.my_company() and public.is_office() and (not money or public.can_money()));
create policy "escritório escreve histórico" on public.service_events for insert with check (company_id = public.my_company() and public.is_office());
create policy "driver vê histórico dos seus" on public.service_events for select using (
  not money and exists (select 1 from public.services s where s.id = service_id and s.driver_id = public.my_driver_id())
);

-- provas
create policy "escritório gere provas" on public.evidence for all using (company_id = public.my_company() and public.is_office()) with check (company_id = public.my_company());
create policy "driver regista provas" on public.evidence for insert with check (
  company_id = public.my_company() and by_user = auth.uid()
  and exists (select 1 from public.services s where s.id = service_id and s.driver_id = public.my_driver_id())
);
create policy "driver vê provas dos seus" on public.evidence for select using (
  exists (select 1 from public.services s where s.id = service_id and s.driver_id = public.my_driver_id())
);

-- localização: o driver só envia durante um serviço seu em curso; só o chefe (ou quem ele autorizar) vê
create policy "driver envia posição em serviço" on public.locations for insert with check (
  company_id = public.my_company() and driver_id = public.my_driver_id()
  and exists (select 1 from public.services s where s.id = service_id and s.driver_id = public.my_driver_id()
              and s.status in ('aceite','a_caminho','a_bordo'))
);
create policy "chefe vê posições" on public.locations for select using (company_id = public.my_company() and public.can_track());

-- folgas
create policy "escritório gere folgas" on public.unavailability for all using (company_id = public.my_company() and public.is_office()) with check (company_id = public.my_company());
create policy "driver gere as suas folgas" on public.unavailability for all using (driver_id = public.my_driver_id()) with check (driver_id = public.my_driver_id() and company_id = public.my_company());

-- avisos
create policy "escritório gere avisos" on public.notices for all using (company_id = public.my_company() and public.is_office()) with check (company_id = public.my_company());
create policy "driver lê os seus avisos" on public.notices for select using (company_id = public.my_company() and (to_driver_id is null or to_driver_id = public.my_driver_id()));
create policy "cada um marca o que leu" on public.notice_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "escritório vê quem leu" on public.notice_reads for select using (public.is_office() and exists (select 1 from public.notices n where n.id = notice_id and n.company_id = public.my_company()));

-- gorjetas: só o próprio
create policy "só eu vejo as minhas gorjetas" on public.driver_tips for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- registo de alterações
create policy "escritório vê o registo" on public.audit_log for select using (company_id = public.my_company() and public.is_office() and (not money or public.can_money()));
create policy "escritório escreve no registo" on public.audit_log for insert with check (company_id = public.my_company() and public.is_office());

-- =====================================================================
-- Funções que a app chama
-- =====================================================================

-- Criar a empresa e tornar quem a cria administrador (primeiro arranque).
create or replace function public.create_company(p_name text, p_full_name text)
returns uuid language plpgsql security definer set search_path = public as
$$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'Sem sessão iniciada'; end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Este utilizador já pertence a uma empresa';
  end if;
  insert into public.companies (name) values (p_name) returning id into cid;
  insert into public.profiles (id, company_id, full_name, role, can_money, can_track)
    values (auth.uid(), cid, coalesce(p_full_name,''), 'admin', true, true);
  insert into public.service_types (company_id, name, name_en, duration_min, position) values
    (cid,'Chegada aeroporto','Airport arrival',90,1),(cid,'Partida aeroporto','Airport departure',60,2),
    (cid,'Transfer','Transfer',60,3),(cid,'À disposição','At disposal',240,4),(cid,'Tour','Tour',300,5),
    (cid,'Longa distância','Long distance',240,6),(cid,'Evento','Event',180,7),(cid,'Casamento','Wedding',300,8),
    (cid,'Outro','Other',60,9);
  return cid;
end $$;

-- O driver muda o estado de um serviço seu. O servidor confirma que o passo é permitido
-- e guarda a hora e o local no histórico.
create or replace function public.driver_set_status(
  p_service uuid, p_status text, p_note text default null,
  p_lat double precision default null, p_lng double precision default null, p_acc int default null)
returns public.services language plpgsql security definer set search_path = public as
$$
declare s public.services; me uuid := public.my_driver_id(); ok boolean := false; start_at timestamptz;
begin
  select * into s from public.services where id = p_service for update;
  if s.id is null or me is null or s.driver_id is distinct from me or s.sent_at is null then
    raise exception 'Este serviço não é teu';
  end if;
  ok := case
    when p_status = 'chegou'    then s.status in ('aceite','a_caminho')
    when p_status = 'aceite'    then s.status in ('enviado','a_caminho')
    when p_status = 'recusado'  then s.status in ('enviado','aceite')
    when p_status = 'a_caminho' then s.status in ('aceite','a_bordo')
    when p_status = 'a_bordo'   then s.status in ('a_caminho','concluido')
    when p_status = 'concluido' then s.status = 'a_bordo'
    when p_status = 'no_show'   then s.status in ('aceite','a_caminho')
    when p_status = 'desfazer'  then s.status = 'no_show'
    else false end;
  if not ok then raise exception 'Passo não permitido a partir de "%"', s.status; end if;

  if p_status = 'no_show' then
    start_at := ((s.date + coalesce(s.time, '00:00'::time)) at time zone 'Europe/Lisbon')
                + make_interval(mins => coalesce(s.wait_min, 60));
    if now() < start_at then raise exception 'Ainda não passou o tempo de espera'; end if;
    update public.services set prev_status = status, status = 'no_show' where id = s.id returning * into s;
  elsif p_status = 'desfazer' then
    update public.services set status = coalesce(prev_status, 'a_caminho') where id = s.id returning * into s;
  elsif p_status = 'chegou' then
    update public.services set arrived_at = now() where id = s.id returning * into s;
  elsif p_status = 'recusado' then
    if p_note is null or length(trim(p_note)) = 0 then raise exception 'Indica o motivo'; end if;
    update public.services set status = 'recusado', decline_reason = p_note, declined_by = me, sent_at = null
      where id = s.id returning * into s;
  else
    update public.services set status = p_status::public.service_status where id = s.id returning * into s;
  end if;

  insert into public.service_events (company_id, service_id, kind, note, lat, lng, accuracy_m, by_user)
    values (s.company_id, s.id, p_status, p_note, p_lat, p_lng, p_acc, auth.uid());
  return s;
end $$;

-- O driver marca que abriu o serviço.
create or replace function public.driver_mark_seen(p_service uuid) returns void
language sql security definer set search_path = public as
$$ update public.services set seen_by_driver = true
   where id = p_service and driver_id = public.my_driver_id() and sent_at is not null $$;

-- O que o driver vai receber pelos seus serviços (sem ver vendas nem margens).
create or replace function public.driver_pay_for(p_service uuid) returns numeric
language sql stable security definer set search_path = public as
$$ select m.driver_pay from public.service_money m join public.services s on s.id = m.service_id
   where m.service_id = p_service and s.driver_id = public.my_driver_id() $$;

-- O preço só aparece ao driver quando o chefe escolhe mostrá-lo.
create or replace function public.driver_price_for(p_service uuid) returns numeric
language sql stable security definer set search_path = public as
$$ select m.price from public.service_money m join public.services s on s.id = m.service_id
   where m.service_id = p_service and s.driver_id = public.my_driver_id() and s.show_price $$;

grant execute on function public.create_company(text, text) to authenticated;
grant execute on function public.driver_set_status(uuid, text, text, double precision, double precision, int) to authenticated;
grant execute on function public.driver_mark_seen(uuid) to authenticated;
grant execute on function public.driver_pay_for(uuid) to authenticated;
grant execute on function public.driver_price_for(uuid) to authenticated;
revoke execute on all functions in schema public from anon;

-- =====================================================================
-- Tempo real: a app recebe as mudanças no momento em que acontecem
-- =====================================================================
alter publication supabase_realtime add table public.services, public.service_events, public.locations, public.evidence, public.notices;

-- =====================================================================
-- Fotografias (provas, despesas, logótipo): pasta privada por empresa
-- O caminho de cada ficheiro começa pelo id da empresa: <company_id>/...
-- =====================================================================
insert into storage.buckets (id, name, public) values ('media', 'media', false)
  on conflict (id) do nothing;

create policy "ver fotografias da minha empresa" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = public.my_company()::text
         and (public.is_office() or owner = auth.uid()));
create policy "enviar fotografias para a minha empresa" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = public.my_company()::text);
create policy "escritório apaga fotografias" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = public.my_company()::text and public.is_office());
