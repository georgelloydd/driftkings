# Mini Drifters

Top-down drift racer in plain HTML/JS. Runs on GitHub Pages with no build step.

Play: https://georgelloydd.github.io/minidrifters/

## Modes
- **Time trial (endless)**: laps go on until you quit. **R** restarts the lap from the start line, **F** puts you back at the last checkpoint, **ESC** ends the session and shows a summary.
- **Race / Drift battle**: solo, or online with friends using a 5-letter room code (PeerJS, peer to peer).

## Controls
W/↑ throttle · S/↓ brake · A D/← → steer · SPACE handbrake · R reset · F checkpoint · C camera · M mute · T chat · ESC menu

## Garage
8 car types (Street, Drift SR, GT, Formula, Hot Hatch, Muscle, Rally, Kei Truck), 7 liveries and 10 colours. They're cosmetic only: every car handles the same. Friends in your room see your design.

## Accounts and leaderboards
Each player gets a secret key (`MD-XXXX-XXXX-XXXX`). The key is the login.

- **Default (no setup):** your profile, stats and the leaderboard are saved in this browser. To move to another device, copy your **backup code** from Account and paste it into Sign in there.
- **Global live leaderboards (optional):** create a free Supabase project, run the SQL below in its SQL editor, then put the project URL and anon key in `js/config.js`. After that, keys work on any device and the leaderboard refreshes every 5 seconds.

```sql
create table profiles (id text primary key, data jsonb not null, updated_at timestamptz default now());
create table laps (id bigint generated always as identity primary key, track int not null, pid text not null,
  name text, color text, body text, lap_ms int not null check (lap_ms > 15000), score int, created_at timestamptz default now());
create index on laps (track, lap_ms);
alter table profiles enable row level security;
alter table laps enable row level security;
create policy "read laps" on laps for select using (true);
create policy "add laps" on laps for insert with check (true);
create policy "read profile" on profiles for select using (true);
create policy "save profile" on profiles for insert with check (true);
create policy "update profile" on profiles for update using (true);
```

The profile id is a hash of your key, so nobody can find your profile without your key. Lap times are sent by the browser, so treat the board as friendly rather than cheat-proof.

## Files
`index.html`, `style.css`, `js/config.js` (online settings), `track.js`, `car.js` (physics), `cars.js` (car types and liveries), `net.js` (multiplayer), `audio.js`, `main.js` (game loop, time trial), `account.js` (accounts and leaderboards), `render.js`, `ui.js` (menus).

## Deploying
Open `deploy.html`, paste a GitHub token and press Deploy. Or push these files to the `main` branch and turn on Pages (Settings → Pages → Deploy from branch → main / root).
