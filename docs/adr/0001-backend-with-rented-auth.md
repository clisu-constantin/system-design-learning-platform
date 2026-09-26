# A progress backend, with sign-in rented from Firebase

The app was browser-only by rule, with progress in `localStorage`. Learners asked for progress that
follows them to another device and survives a cleared browser, so we added an optional Account:
a FastAPI service with its own Postgres on Railway, next to the static app, in the same repo
(`server/`). Sign-in (email and password, Google, confirm and reset emails) is done by Firebase
Auth on its free plan; FastAPI only checks the Firebase ID token and owns the progress data. The app
still works fully as a Guest, and the server is a backup and a bridge between devices, never a gate.

## Considered Options

- **Build sign-in in FastAPI** - rejected: password storage, reset emails, Google OAuth and
  brute-force protection are easy to get wrong for a feature that only saves study progress.
- **Supabase Auth, or Supabase Postgres** - rejected for Firebase Auth by preference; the progress
  data stays in Railway Postgres either way, so changing the auth service later does not move data.
- **Clerk** - rejected: smaller free plan and more JavaScript in the app.

## Consequences

- The Firebase SDK is loaded only when needed (the Learner clicks Sign in, or this browser was
  signed in before), so a Guest never downloads it and the 125 KB initial bundle budget holds.
- Progress stays local-first: every change is saved in the browser, then sent to the server in the
  background and retried, so an offline phone or a down server loses nothing.
- Progress is stored one row per Concept per Account, with the time of its last change, because
  merging two devices needs "latest change wins" for Done and "best score" for the Quiz.
