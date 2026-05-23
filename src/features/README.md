# Feature Folder Guide

Each ticket should place new components, hooks, validation, and mock data in its own feature folder first. The old page files in `src/pages/` can then import those feature components with a small final change.

This folder exists to reduce merge conflicts:

- Mongkol works in `auth/` and `admin/`.
- Heng works in `home/`, `booking/`, and `profile/`.
- Sak works in `rental/` and `checkout/`.

See `docs/TEAM_FILE_OWNERSHIP.md` for the full assignment map.
