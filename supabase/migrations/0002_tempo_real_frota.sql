-- 0002: drivers, viaturas e tipos de serviço também passam a avisar a app em tempo real.
-- Correr primeiro no despacho-preprod. No prod, só quando lançarmos.
alter publication supabase_realtime add table public.drivers, public.vehicles, public.service_types;

-- Verificação: deve listar services, service_events, locations, evidence, notices, drivers, vehicles, service_types
select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;
