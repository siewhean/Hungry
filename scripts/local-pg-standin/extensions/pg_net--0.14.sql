-- Stub pg_net. Same http_post signature as the real extension; requests are
-- stored only. The net schema itself is pre-created by standin.sql.

create table net.http_request_queue (
  id bigserial primary key,
  method text not null,
  url text not null,
  headers jsonb not null,
  body bytea,
  timeout_milliseconds integer not null
);

create function net.http_post(
  url text,
  body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{"Content-Type": "application/json"}'::jsonb,
  timeout_milliseconds integer default 5000
)
returns bigint
language sql
security definer
as $$
  insert into net.http_request_queue (method, url, headers, body, timeout_milliseconds)
  values ('POST', url, headers, convert_to(body::text, 'UTF8'), timeout_milliseconds)
  returning id;
$$;
