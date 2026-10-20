# Ember interface

The Next.js interface for Ember's burnout assessment and session collection workflow.

- `/`: the original video landing page, with links to assessment and session collection.
- `/dashboard`: session dashboard with activity measurements and separately enabled face, voice, and conversation inputs.
- `/evaluate`: the original check-in form and assessment results, with evidence selection and report download.
- `/login`: local account access. Accounts do not isolate backend observations.

Run `npm ci` and `npm run dev` alongside the Python backend. The backend defaults to `http://localhost:8000`; configure `NEXT_PUBLIC_API_URL` when using another address. Provider credentials belong in the backend environment only.

The landing page and assessment retain their original dark styling and typography. The dashboard and account routes use the new workspace layout. Refreshing assessment evidence keeps form answers and clears evidence selections.

Run `npm run build` to check the production build. See the [project README](../README.md) for setup, data handling, agent behavior, and prediction scope.
