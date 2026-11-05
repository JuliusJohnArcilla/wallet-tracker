# Integrations

| Service | Purpose | You supply | Test / sandbox |
|---|---|---|---|
| GitHub Pages + Actions | Run tests, then publish the site | One-time: repo **Settings → Pages → Build and deployment → Source: GitHub Actions** | Every push runs the workflow; failures don't publish |
| GitHub Gist API | Optional sync between devices | A personal access token with only the `gist` scope, pasted into the app (stored on that device only) | Use a throwaway token/account to try it |
| Calendar (.ics file) | Due-date reminders via the phone's calendar | Nothing | Import the file into any calendar app |

No keys or secrets are needed to build or run the app. `.env.example` exists only to document that.
