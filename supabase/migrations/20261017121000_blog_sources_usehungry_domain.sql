-- Hungry's public site moved from hungry.sg to usehungry.com.
update blog_sources
set homepage_url = 'https://usehungry.com'
where homepage_url = 'https://hungry.sg';
