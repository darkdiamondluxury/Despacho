-- 0003: dar à chave secreta (papel service_role) acesso às tabelas.
-- Os projetos Supabase recentes não dão permissões automáticas a tabelas criadas por SQL.
-- A 0001 deu acesso a "authenticated" (a app); faltava o "service_role" (as Edge Functions).
-- O service_role ignora as regras de acesso (RLS) por desenho: só existe no servidor.
grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Para tabelas que criarmos em migrações futuras, já ficarem com as permissões certas:
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
