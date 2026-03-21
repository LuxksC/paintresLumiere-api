# Bruno collection (Paintres Lumiere API)

This folder is a [Bruno](https://www.usebruno.com/) collection stored as plain files so you can commit it to GitHub and review changes in pull requests.

## Setup

1. Install [Bruno](https://www.usebruno.com/downloads).
2. In Bruno: **Open Collection** → choose `bruno/paintres-lumiere-api` (the folder that contains `bruno.json`).
3. Select the **Local** environment (top bar).
4. Edit **Local** → set `baseUrl` to your API Gateway URL (from `serverless deploy`, no trailing slash).
5. Optional: copy `paintres-lumiere-api/.env.example` to `paintres-lumiere-api/.env` and set `ACCESS_TOKEN` if you want to start with a token without running Signup/Login first.

## Flow

1. Run **Get Status** (no auth).
2. Run **Signup** or **Login** — a post-response script saves `accessToken` into the **Local** environment (`persist: true` in Bruno).
3. Run **Logout** or **Delete Me** with the saved Bearer token.

## GitHub

Commit the whole `bruno/` directory. Do **not** commit `.env` (it is listed in `bruno/paintres-lumiere-api/.gitignore`).

You can also import `docs/openapi.yaml` into Bruno once to generate requests, then keep this folder as the source of truth for the team.
