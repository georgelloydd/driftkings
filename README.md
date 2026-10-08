# 🏎️ Drift Kings

Top-down drift racing in the browser. Play solo or race your friends online. No server or installs needed.

## Controls
| Key | Action |
|---|---|
| W / ↑ | Throttle |
| S / ↓ | Brake / reverse |
| A D / ← → | Steer |
| SPACE | Handbrake (start a drift) |
| R | Reset (Time trial: back to the rolling start; other modes: back onto the track) |
| F | Reset to your last checkpoint |
| C | Toggle top-down / chase camera |
| T | Chat (online) |
| M | Mute |
| ESC | Menu / leave |

**Drifting:** go fast into a corner, tap SPACE or steer hard, then counter-steer to hold the slide. Chain drifts for combos up to x5. Going off the track or hitting a car loses the points from your current drift.

## Modes
- **Race:** fastest to finish the laps wins.
- **Drift battle:** most drift points by the end wins.
- **Time trial:** solo. You start a long way behind the line so you hit it at full speed; every lap is timed and your PB is saved. R restarts the run.
- **Free roam:** set laps to "Free roam" to practise or mess around with friends.

3 tracks: Sunset Circuit, Neon Docks (night) and Snowpeak Hairpins.

## Put it on GitHub Pages (free)
1. Create a new **public** repository on github.com (for example `drift-kings`).
2. Click **Add file → Upload files** and drag in everything from this folder (`index.html`, `style.css`, `.nojekyll`, `README.md` and the `js` folder). Commit.
3. Go to **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then Save.
4. After about a minute your game is live at `https://YOUR-USERNAME.github.io/drift-kings/`.

## Playing with friends
1. Everyone opens the GitHub Pages link.
2. One person clicks **Host online race** and gets a 5-letter room code.
3. Friends type the code and click **Join friend** (up to 8 players).
4. The host picks the track, laps and mode, then clicks **Start race**.

Multiplayer is peer-to-peer (WebRTC via [PeerJS](https://peerjs.com/)). PeerJS's free public server only introduces players to each other. Very strict networks (some school or work Wi-Fi) can block peer-to-peer connections. If joining times out, try home Wi-Fi or a phone hotspot.

The host's game relays positions, so if the host leaves, the room closes.

## Run locally
Open a terminal in this folder and run `python3 -m http.server`, then visit http://localhost:8000. Online play needs an internet connection.
