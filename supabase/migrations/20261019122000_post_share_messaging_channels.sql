-- Record WhatsApp and Telegram post shares with their real channel.
--
-- post_shares.share_channel only allowed in_app, system_share and copy_link,
-- so the app logged WhatsApp and Telegram shares as system_share.

alter table public.post_shares
  drop constraint if exists post_shares_share_channel_check;

alter table public.post_shares
  add constraint post_shares_share_channel_check
  check (share_channel in ('in_app', 'system_share', 'copy_link', 'whatsapp', 'telegram'));
