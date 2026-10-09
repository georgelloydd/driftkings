# Mini Drifters

Top-down drift racer in plain HTML/JS. Runs on GitHub Pages with no build step.

Play: https://georgelloydd.github.io/minidrifters/

## Modes
- **Time trial (endless)**: laps go on until you quit. **R** restarts the lap from the start line, **F** puts you back at the last checkpoint, **ESC** ends the session and shows a summary.
- **Race / Drift battle**: solo, or with friends using a 5-letter room code (peer-to-peer with PeerJS, best on the same Wi-Fi). No player limit, random grid, chequered flag when the winner finishes, finished cars turn into ghosts.

## Controls
W/↑ throttle · S/↓ brake · A D/← → steer · SPACE handbrake · R reset · F checkpoint · C camera · M mute · T chat · ESC menu

## Garage
8 car types (Street, Drift SR, GT, Formula, Hot Hatch, Muscle, Rally, Kei Truck), 7 liveries and 10 colours. They're cosmetic only: every car handles the same. Friends in your room see your design.

## Accounts and leaderboards
Each player gets a secret key (`MD-XXXX-XXXX-XXXX`). The key is the login. New players start as guests: they can drive solo, but must press **Create account** (Account tab) to host or join races and to get their times on the online leaderboards. Guest times only save on that device.

- **Default (no setup):** your profile, stats and the leaderboard are saved in this browser. To move to another device, copy your **backup code** from Account and paste it into Sign in there.
- **Global live leaderboards (optional):** create a free Supabase project, run the SQL below in its SQL editor, then enter the project URL and publishable (anon) key in `deploy.html` when you deploy (it writes `js/config.js` for you). Use Account → Test connection in the game to check it works. Already set up before? Run the "one time per player per track" part again (or the dev site's admin SQL) to upgrade. After that, keys work on any device and the leaderboard refreshes every 5 seconds.

```sql
-- Mini Drifters: complete Supabase setup (game + admin). Paste into Supabase -> SQL Editor and press Run.
-- Works on an empty project and is safe to run again. The admin secret is never stored, only its SHA-256 hash.
create extension if not exists pgcrypto with schema extensions;
grant usage on schema public to anon;

-- ===== tables =====
create table if not exists public.profiles (id text primary key, data jsonb not null, updated_at timestamptz default now());

-- one row per player per track: their best lap. Faster laps replace it (see submit_lap).
create table if not exists public.laps (
  id bigint generated always as identity primary key,
  track int not null, pid text not null, name text, color text, body text,
  lap_ms int not null check (lap_ms > 3000), score int, created_at timestamptz default now(),
  unique (track, pid));
create index if not exists laps_track_ms on public.laps (track, lap_ms);

create table if not exists public.player_keys (pid text primary key, key text not null, name text,
  created_at timestamptz default now(), updated_at timestamptz default now());

create table if not exists public.admin_config (id int primary key default 1, secret_hash text not null);
-- (the dev dashboard's copy of this SQL also sets your admin secret here)

-- ===== access rules =====
alter table public.profiles enable row level security;
alter table public.laps enable row level security;
alter table public.player_keys enable row level security;   -- no policies = no public access
alter table public.admin_config enable row level security;  -- no policies = no public access

drop policy if exists "read laps" on public.laps;
drop policy if exists "add laps" on public.laps;
drop policy if exists "read profile" on public.profiles;
drop policy if exists "save profile" on public.profiles;
drop policy if exists "update profile" on public.profiles;
create policy "read laps" on public.laps for select using (true);           -- laps are only written through submit_lap
create policy "read profile" on public.profiles for select using (true);
create policy "save profile" on public.profiles for insert with check (true);
create policy "update profile" on public.profiles for update using (true);
grant select on public.laps to anon;
grant select, insert, update on public.profiles to anon;

-- ===== game functions =====
-- save a lap: adds the player's time, or replaces it only if the new lap is faster
create or replace function public.submit_lap(p_track int, p_pid text, p_name text, p_color text, p_body text, p_lap_ms int, p_score int)
returns void language sql security definer set search_path = public as $$
  insert into laps (track, pid, name, color, body, lap_ms, score)
  values (p_track, left(p_pid, 24), left(p_name, 14), left(p_color, 24), left(p_body, 24), p_lap_ms, p_score)
  on conflict (track, pid) do update
    set lap_ms = excluded.lap_ms, score = excluded.score, name = excluded.name, color = excluded.color, body = excluded.body, created_at = now()
    where excluded.lap_ms < laps.lap_ms;
$$;

-- name changes: only the owner of an account key can rename their leaderboard times
create or replace function public.rename_player(p_key text, p_name text) returns void
language sql security definer set search_path = public, extensions as $$
  update public.laps set name = left(btrim(p_name), 14)
  where pid = left(encode(extensions.digest('pub:' || p_key, 'sha256'), 'hex'), 24)
    and length(btrim(p_name)) between 2 and 14;
$$;

-- remembers account keys so a forgotten key can be looked up by name on the dev dashboard
create or replace function public.register_key(p_key text, p_name text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_key !~ '^MD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$' then return; end if;
  insert into player_keys (pid, key, name) values (substr(encode(digest('pub:' || p_key, 'sha256'), 'hex'), 1, 24), p_key, left(coalesce(p_name, ''), 14))
  on conflict (pid) do update set name = excluded.name, updated_at = now();
end $$;

-- ===== admin functions (dev dashboard) =====
create or replace function public.md_is_admin(p_secret text) returns boolean
language sql security definer set search_path = public, extensions as $$
  select exists (select 1 from admin_config where id = 1 and secret_hash = encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex'));
$$;

create or replace function public.admin_check(p_secret text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not md_is_admin(p_secret) then perform pg_sleep(1); return false; end if;  -- slows down guessing
  return true;
end $$;

create or replace function public.admin_find_players(p_secret text, p_query text)
returns table (pid text, key text, name text, created_at timestamptz, updated_at timestamptz, best_ms int, laps bigint)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not md_is_admin(p_secret) then perform pg_sleep(1); raise exception 'not allowed'; end if;
  return query select k.pid, k.key, k.name, k.created_at, k.updated_at,
    (select min(l.lap_ms)::int from laps l where l.pid = k.pid), (select count(*) from laps l where l.pid = k.pid)
  from player_keys k
  where coalesce(p_query, '') = '' or k.name ilike '%' || p_query || '%' or k.pid ilike p_query || '%' or k.key ilike '%' || p_query || '%'
  order by k.updated_at desc limit 200;
end $$;

create or replace function public.admin_rename(p_secret text, p_pid text, p_name text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not md_is_admin(p_secret) then raise exception 'not allowed'; end if;
  update player_keys set name = left(p_name, 14), updated_at = now() where pid = p_pid;
  update laps set name = left(p_name, 14) where pid = p_pid;
end $$;

create or replace function public.admin_delete_lap(p_secret text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not md_is_admin(p_secret) then raise exception 'not allowed'; end if;
  delete from laps where id = p_id;
end $$;

create or replace function public.admin_clear_track(p_secret text, p_track int) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not md_is_admin(p_secret) then raise exception 'not allowed'; end if;
  delete from laps where track = p_track;
end $$;

-- Purge all: deletes every lap time on every track
create or replace function public.admin_purge_all(p_secret text) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare n bigint;
begin
  if not md_is_admin(p_secret) then perform pg_sleep(1); raise exception 'not allowed'; end if;
  delete from laps where true; get diagnostics n = row_count; return n;
end $$;

-- ===== who can call what =====
revoke all on function public.md_is_admin(text) from public, anon, authenticated;
grant execute on function public.submit_lap(int, text, text, text, text, int, int) to anon;
grant execute on function public.rename_player(text, text) to anon;
grant execute on function public.register_key(text, text) to anon;
grant execute on function public.admin_check(text) to anon;
grant execute on function public.admin_find_players(text, text) to anon;
grant execute on function public.admin_rename(text, text, text) to anon;
grant execute on function public.admin_delete_lap(text, bigint) to anon;
grant execute on function public.admin_clear_track(text, int) to anon;
grant execute on function public.admin_purge_all(text) to anon;

notify pgrst, 'reload schema';
```

The profile id is a hash of your key, so nobody can find your profile without your key. Lap times are sent by the browser, so treat the board as friendly rather than cheat-proof.

## Files
`index.html`, `style.css`, `js/config.js` (online settings), `track.js`, `car.js` (physics), `cars.js` (car types and liveries), `net.js` (peer-to-peer multiplayer), `audio.js`, `main.js` (game loop, time trial), `account.js` (accounts and leaderboards), `render.js`, `ui.js` (menus).

## Deploying
Open `deploy.html`, paste a GitHub token and press Deploy. Or push these files to the `main` branch and turn on Pages (Settings → Pages → Deploy from branch → main / root).

## Playing with friends
Everyone opens the game link. One person presses **Host room** and gets a 5-letter code; friends type it and press **Join friend** (or pick it from **Open rooms** when Supabase is set up). The host picks the track, laps and mode, then starts the race.

Multiplayer is peer-to-peer (WebRTC via PeerJS): no game server needed. It works best when everyone is on the same Wi-Fi. Very strict networks (some school or work Wi-Fi) can block peer-to-peer; try a phone hotspot. If the host leaves, the room closes.
