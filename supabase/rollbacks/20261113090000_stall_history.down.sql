-- Undo 20261113090000_stall_history: drops stall history, its writers, trigger and rate rule, and
-- takes stallHistory back out of the data export.
-- expect-row-loss: app_private.request_rate_rules, public.user_stall_affinities
-- down-loses-data: user_stall_affinities only (learned stall history; saved and tried stalls stay in user_stall_interactions).

-- export_my_data back to 20261111090000's body (no stallHistory).
create or replace function app_private.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_data jsonb;
begin
  if v_user is null then
    raise exception 'export_my_data requires a signed-in user' using errcode = '42501';
  end if;

  v_data := jsonb_build_object(
    'profile',
      (select to_jsonb(t) from public.user_profiles t where t.id = v_user),
    'privacySettings',
      (select to_jsonb(t) from public.privacy_settings t where t.user_id = v_user),
    'appSettings',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_settings t where t.user_id = v_user), '[]'::jsonb),
    'notificationPreferences',
      (select to_jsonb(t) from public.notification_preferences t where t.user_id = v_user),
    'tasteVector',
      (select to_jsonb(t) from public.user_taste_vectors t where t.user_id = v_user),
    'quizResponses',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.quiz_responses t where t.user_id = v_user), '[]'::jsonb),
    'tasteEvents',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.taste_interaction_events t where t.user_id = v_user), '[]'::jsonb),
    'favouriteDishes',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_favourite_dishes t where t.user_id = v_user), '[]'::jsonb),
    'foodHistory',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_dish_affinities t where t.user_id = v_user), '[]'::jsonb),
    'reviews',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.reviews t where t.user_id = v_user), '[]'::jsonb),
    'posts',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.posts t where t.author_id = v_user), '[]'::jsonb),
    'postComments',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.post_comments t where t.user_id = v_user), '[]'::jsonb),
    'postLikes',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.post_likes t where t.user_id = v_user), '[]'::jsonb),
    'savedPosts',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.post_saves t where t.user_id = v_user), '[]'::jsonb),
    'postShares',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.post_shares t where t.user_id = v_user), '[]'::jsonb),
    'hiddenPosts',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.hidden_posts t where t.viewer_id = v_user), '[]'::jsonb),
    'bites',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.bites t where t.author_id = v_user), '[]'::jsonb),
    'biteReactions',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.bite_reactions t where t.user_id = v_user), '[]'::jsonb),
    'follows',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.follows t where t.follower_id = v_user or t.followee_id = v_user), '[]'::jsonb),
    'followedStalls',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.stall_follows t where t.user_id = v_user), '[]'::jsonb),
    'activityDays',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_activity_days t where t.user_id = v_user), '[]'::jsonb),
    'blocks',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_blocks t where t.blocker_id = v_user), '[]'::jsonb),
    'contentReports',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.content_reports t where t.reporter_id = v_user), '[]'::jsonb),
    'postReports',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.post_reports t where t.reporter_id = v_user), '[]'::jsonb),
    'checklists',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.checklists t where t.user_id = v_user), '[]'::jsonb),
    'checklistItems',
      coalesce((
        select jsonb_agg(to_jsonb(i))
        from public.checklist_items i
        join public.checklists c on c.id = i.checklist_id
        where c.user_id = v_user
      ), '[]'::jsonb),
    'portfolios',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.portfolios t where t.owner_id = v_user), '[]'::jsonb),
    'passportStamps',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.passport_stamps t where t.user_id = v_user), '[]'::jsonb),
    'foodCred',
      (select to_jsonb(t) from public.user_food_cred t where t.user_id = v_user),
    'foodCredEvents',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.food_cred_events t where t.user_id = v_user), '[]'::jsonb),
    'stallSubmissions',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_stall_submissions t where t.user_id = v_user), '[]'::jsonb),
    'menuPhotoSubmissions',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.menu_photo_submissions t where t.submitted_by = v_user), '[]'::jsonb),
    'conversations',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.conversation_participants t where t.participant_user_id = v_user), '[]'::jsonb),
    'messagesSent',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.messages t where t.sender_user_id = v_user), '[]'::jsonb),
    'activity',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.activity_events t where t.recipient_id = v_user), '[]'::jsonb),
    'merchantAccounts',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.merchant_accounts t where t.user_id = v_user), '[]'::jsonb),
    'accountDeletionRequests',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.account_deletion_requests t where t.user_id = v_user), '[]'::jsonb),
    'reviewHelpfulVotes',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.review_helpful_votes t where t.user_id = v_user), '[]'::jsonb),
    'portfolioItems',
      coalesce((
        select jsonb_agg(to_jsonb(i))
        from public.portfolio_items i
        join public.portfolios p on p.id = i.portfolio_id
        where p.owner_id = v_user
      ), '[]'::jsonb),
    'portfolioCollaborations',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.portfolio_collaborators t where t.user_id = v_user), '[]'::jsonb),
    'portfolioFollows',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.portfolio_follows t where t.user_id = v_user), '[]'::jsonb),
    'recommendationImpressions',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.recommendation_impressions t where t.user_id = v_user), '[]'::jsonb),
    'passportProgressEvents',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.passport_progress_events t where t.user_id = v_user), '[]'::jsonb),
    'stallInteractions',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_stall_interactions t where t.user_id = v_user), '[]'::jsonb),
    'missionProgress',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_mission_progress t where t.user_id = v_user), '[]'::jsonb),
    'moodSearchQueries',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.mood_search_queries t where t.user_id = v_user), '[]'::jsonb),
    'merchantMemberships',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.merchant_members t where t.user_id = v_user), '[]'::jsonb),
    'merchantClaimInterests',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.merchant_claim_interests t where t.claimed_by = v_user), '[]'::jsonb)
  ) || jsonb_build_object(
    'profileFavouriteDishes',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.position) from public.profile_favourite_dishes t where t.user_id = v_user), '[]'::jsonb),
    'tasteRatings',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.dish_taste_ratings t where t.user_id = v_user), '[]'::jsonb),
    'catalogCorrections',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.catalog_corrections t where t.reporter_id = v_user), '[]'::jsonb),
    'notificationJobs',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.notification_jobs t where t.user_id = v_user), '[]'::jsonb)
  ) || jsonb_build_object(
    'portfolioPoints',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.leaderboard_events t where t.user_id = v_user), '[]'::jsonb),
    'achievementUnlocks',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.unlocked_at) from public.achievement_unlocks t where t.user_id = v_user), '[]'::jsonb),
    'leaderboardWeekResults',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.week_start) from public.leaderboard_week_results t where t.user_id = v_user), '[]'::jsonb),
    'portfolioPicks',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.kind, t.slot) from public.portfolio_picks t where t.user_id = v_user), '[]'::jsonb)
  );

  return jsonb_build_object(
    'exportVersion', 2,
    'generatedAt', now(),
    'categories', (select jsonb_agg(k order by k) from jsonb_object_keys(v_data) as k),
    'notIncluded', jsonb_build_array(
      'Push notification tokens (device identifiers that are only used to deliver alerts).',
      'Security, moderation and legal records. Email support to request these.',
      'Rate-limit counters and abuse-protection logs (security records, not personal content).',
      'Lists you reported (list reports are moderation records).'
    ),
    'data', v_data
  );
end;
$$;

delete from app_private.request_rate_rules where route = 'rpc/record_stall_signal';

drop trigger if exists user_stall_affinities_from_interaction on public.user_stall_interactions;
drop function if exists app_private.user_stall_affinities_from_interaction();
drop function if exists public.record_stall_signal(text, text);
drop function if exists app_private.record_stall_signal(text, text);
drop function if exists app_private.apply_stall_affinity_event(uuid, text, numeric, timestamptz, boolean);
drop table if exists public.user_stall_affinities;
