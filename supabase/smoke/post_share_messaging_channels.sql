-- Smoke checks for 20261019122000_post_share_messaging_channels.sql.
-- WhatsApp and Telegram shares are accepted; unknown channels are still
-- rejected. Rolls back.

begin;

insert into user_profiles (id, display_name)
values ('00000000-0000-0045-b000-000000000001', 'Share Channel Smoke')
on conflict (id) do nothing;

insert into posts (id, author_id, status, visibility, caption, published_at)
values (
  '00000000-0000-0045-c000-000000000001',
  '00000000-0000-0045-b000-000000000001',
  'published',
  'public',
  'Share channel smoke post',
  now()
);

insert into post_shares (post_id, user_id, share_channel)
values
  ('00000000-0000-0045-c000-000000000001', '00000000-0000-0045-b000-000000000001', 'whatsapp'),
  ('00000000-0000-0045-c000-000000000001', '00000000-0000-0045-b000-000000000001', 'telegram');

do $$
begin
  begin
    insert into post_shares (post_id, user_id, share_channel)
    values (
      '00000000-0000-0045-c000-000000000001',
      '00000000-0000-0045-b000-000000000001',
      'carrier_pigeon'
    );
    raise exception 'Unknown share channel should be rejected';
  exception
    when check_violation then null;
  end;
end $$;

rollback;
