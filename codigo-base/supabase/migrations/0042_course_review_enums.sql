-- Commit these additions before 0043 uses them.
alter type public.notification_type add value if not exists 'revisao_curso';
alter type public.xp_event_origin add value if not exists 'review_bonus';
