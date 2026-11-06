-- 0014_username_to_email.sql
--
-- Login-by-username support. The frontend lets a user sign in with either an
-- email address or a username. Supabase Auth only authenticates by email, and
-- the email lives in auth.users (NOT in public.profiles), which is not
-- readable by the anon role.
--
-- SECURITY HISTORY / TRADEOFF
-- ---------------------------------------------------------------------------
-- The original design exposed `username_to_email(username)` to the `anon` role
-- and returned the REAL auth email for ANY existing username. That is an email
-- harvesting primitive: an unauthenticated caller could map every username to a
-- real inbox, which is strictly more than a normal failed login reveals.
--
-- This migration closes that vector. The username is now resolved to an email
-- ONLY when the caller also presents the correct password, via a credential
-- check performed server-side against auth.users.encrypted_password (bcrypt,
-- using pgcrypto's crypt()). An attacker who does not know the password learns
-- nothing beyond a generic failure — the same signal as a normal failed login —
-- so the function can no longer be used to enumerate or harvest email addresses.
--
-- The returned email is then used by the client for
-- supabase.auth.signInWithPassword, which independently re-verifies the password
-- through GoTrue. Returning the email only after a correct password check does
-- not weaken auth (the caller already proved knowledge of the password) and keeps
-- the login-by-username UX intact.
--
-- Notes:
--   * SECURITY DEFINER so it can read auth.users while running as the owner.
--   * Lookup is case-insensitive on username (profiles.username is citext) and
--     restricted to active (non-deactivated) profiles.
--   * Returns NULL for an unknown username, a wrong password, OR a deactivated
--     account — the client surfaces a single generic "invalid credentials"
--     error, so none of these cases are distinguishable to the caller.
--   * The legacy single-argument `username_to_email(text)` is dropped so no
--     anon-callable email-exposing overload remains.

-- Remove the legacy email-exposing overload entirely (no raw-email lookup left).
drop function if exists public.username_to_email(text);

create or replace function public.resolve_login_email(
  p_username text,
  p_password text
)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
stable
as $$
declare
  v_email         text;
  v_encrypted_pw  text;
begin
  -- Resolve only active accounts; case-insensitive via citext username.
  select u.email, u.encrypted_password
    into v_email, v_encrypted_pw
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.username = p_username
     and p.account_status = 'active'
   limit 1;

  -- Unknown username, missing password hash, or no password supplied: reveal
  -- nothing (identical to a wrong-password result).
  if v_email is null or v_encrypted_pw is null or coalesce(p_password, '') = '' then
    return null;
  end if;

  -- Verify the supplied password against the stored bcrypt hash. crypt() with
  -- the stored hash as salt reproduces the hash iff the password matches.
  if crypt(p_password, v_encrypted_pw) = v_encrypted_pw then
    return v_email;
  end if;

  return null;
end;
$$;

comment on function public.resolve_login_email(text, text) is
  'Resolve a username to its auth email ONLY when the supplied password matches (bcrypt check against auth.users). SECURITY DEFINER; returns NULL for unknown user / wrong password / deactivated account so it cannot be used to harvest emails. Used for login-by-username before supabase.auth.signInWithPassword.';

-- Allow anonymous (pre-auth) and authenticated callers to resolve a login email.
-- Exposure is gated by the password check inside the function.
grant execute on function public.resolve_login_email(text, text) to anon, authenticated;
