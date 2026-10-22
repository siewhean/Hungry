-- Stub pg_cron. Same call shapes as the real extension; jobs are stored only.
-- The cron schema itself is pre-created by standin.sql (as on Supabase).

create table cron.job (
  jobid bigserial primary key,
  schedule text not null,
  command text not null,
  nodename text not null default 'localhost',
  nodeport integer not null default 5432,
  database text not null default current_database(),
  username text not null default current_user,
  active boolean not null default true,
  jobname text
);
create unique index jobname_username_uniq on cron.job (jobname, username);

create function cron.schedule(job_name text, schedule text, command text)
returns bigint
language plpgsql
as $$
declare
  v_id bigint;
begin
  insert into cron.job (jobname, schedule, command)
  values (job_name, schedule, command)
  on conflict (jobname, username)
  do update set schedule = excluded.schedule, command = excluded.command
  returning jobid into v_id;
  return v_id;
end;
$$;

create function cron.schedule(schedule text, command text)
returns bigint
language sql
as $$
  insert into cron.job (schedule, command) values (schedule, command) returning jobid;
$$;

create function cron.unschedule(job_id bigint)
returns boolean
language plpgsql
as $$
begin
  delete from cron.job where jobid = job_id;
  if not found then
    raise exception 'could not find valid entry for job %', job_id;
  end if;
  return true;
end;
$$;

create function cron.unschedule(job_name text)
returns boolean
language plpgsql
as $$
begin
  delete from cron.job where jobname = job_name and username = current_user;
  if not found then
    raise exception 'could not find valid entry for job ''%''', job_name;
  end if;
  return true;
end;
$$;
