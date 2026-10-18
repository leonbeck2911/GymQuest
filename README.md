# GymQuest Web

A mobile-first, installable workout tracker built with plain HTML, CSS and JavaScript. No Node packages or build step are required.

## Features
- Built-in exercise library plus custom exercises
- Create, edit, and delete workout routines
- Follow a workout checklist with sets, reps, weight notes, and a 90-second rest timer
- XP, levels, streaks, achievements, and workout history
- Local browser storage (no account/server/database required)
- PWA manifest and service worker for installability and offline app shell

## Run locally
1. Extract this folder.
2. Open a terminal in the folder.
3. Run `python -m http.server 8080` (Python must be installed), or use VS Code's Live Server extension.
4. Open `http://localhost:8080`.

Opening `index.html` directly works for the core app, but service-worker/offline installation requires localhost or HTTPS.

## Deploy on Render (Static Site)
1. Create a GitHub repository and upload the contents of this folder to the repository root.
2. Sign in at https://render.com and choose **New → Static Site**.
3. Connect your GitHub repository.
4. Use:
   - **Root Directory:** blank if these files are at repository root
   - **Build Command:** leave blank
   - **Publish Directory:** `.`
5. Create the site and wait for the `onrender.com` URL.
6. Open the HTTPS URL on your Android phone in Chrome.
7. In Chrome, use the three-dot menu → **Install app** or **Add to Home screen**.

## Important data note
Workout data is stored in the browser on the device where you use the app. Clearing browser/site data can delete it, and data does not automatically sync between devices. Export/cloud backup can be added later.

## XP rules in this starter
- 10 XP for each exercise checked complete
- 50 XP for finishing a workout session
- Achievements award additional XP
- Levels require progressively more XP
- A streak advances on distinct calendar days with at least one completed workout

## Troubleshooting
- If you edit files after deploying, Render will redeploy after the next commit/push.
- If offline mode doesn't update after changes, close the installed app and reload once while online; the service-worker cache is versioned in `service-worker.js`.


## Body and ride tracking (v2)
- Weight entries are saved locally with their date and exact change from the previous measurement.
- Bicycle rides can be recorded using the phone's GPS; the app draws and stores the route points and distance. Keep the page open and grant location permission while riding.
- Past rides can also be added manually with distance, date, and route notes.
- The map uses Leaflet and OpenStreetMap tiles and therefore needs an internet connection. GPS route tracking requires HTTPS and location permission.
- All data remains in this browser/device; clearing browser storage can erase it.

### Updating the existing Render site
Upload the updated `index.html`, `app.js`, `style.css`, and `service-worker.js` to the existing GitHub `GymQuest` repository and commit the changes. Render will redeploy automatically. Existing GymQuest local progress remains in the same browser storage key.
