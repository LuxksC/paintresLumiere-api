# Paintres Lumiere API

Backend API for **Paintres Lumiere**, built with the Serverless Framework on AWS (Lambda + API Gateway). The API is written in TypeScript and follows a controller-based structure with shared HTTP types and utilities.

---

## Tech stack

- **Runtime:** Node.js 20.x (ARM64)
- **Language:** TypeScript
- **Framework:** [Serverless Framework](https://www.serverless.com/) (AWS provider)
- **Region:** `sa-east-1`
- **API:** AWS Lambda + HTTP API (API Gateway v2)
- **Database:** [Neon](https://neon.tech/) (serverless Postgres) + [Drizzle ORM](https://orm.drizzle.team/) (`drizzle-orm/neon-http`)

---

## Project structure

```
paintresLumiere-api/
├── serverless.yml          # Service config, functions, and HTTP events
├── package.json
├── drizzle.config.ts      # Drizzle Kit config (migrations, schema path)
├── .env.example            # Example env vars (copy to .env and fill)
├── handler.js              # Legacy/example handler (not used by current routes)
├── drizzle/                # Generated migrations
│   ├── 0000_initial.sql
│   └── meta/
└── src/
    ├── functions/          # Lambda entry points
    │   ├── status.ts
    │   ├── signup.ts
    │   ├── login.ts
    │   ├── logout.ts
    │   └── deleteUser.ts
    ├── controllers/        # Business logic per route/feature
    │   ├── StatusController.ts
    │   ├── SignUpController.ts
    │   ├── LoginController.ts
    │   ├── LogoutController.ts
    │   └── DeleteUserController.ts
    ├── db/
    │   ├── index.ts        # Drizzle client (Neon serverless)
    │   └── schema.ts       # users table
    ├── libs/
    │   └── jwt.ts          # signAccessToken, validateAccessToken
    ├── types/
    │   └── Http.ts
    └── utils/
        ├── http.ts
        ├── parseEvent.ts
        ├── parseProtectedEvent.ts  # Event + JWT → ProtectedHttpRequest
        └── parseResponse.ts
```

---

## Architecture

1. **API Gateway** receives the HTTP request and invokes the Lambda function configured in `serverless.yml`.
2. **Function** (`src/functions/*.ts`) receives the raw event, optionally parses it with `parseEvent`, and calls the appropriate **controller**.
3. **Controller** returns an `HttpResponse` (status code + optional body) using helpers from `src/utils/http.ts`.
4. **parseResponse** turns that into the object Lambda/API Gateway expect (`statusCode` + stringified `body`).

Shared types in `src/types/Http.ts` keep requests and responses consistent across handlers and controllers.

---

## Environment variables

Copy `.env.example` to `.env` and set real values (see [Neon](https://neon.com/docs/get-started/connect-neon) and your Neon dashboard for the connection string):

| Variable        | Description |
|----------------|-------------|
| `DATABASE_URL` | Neon Postgres connection string |
| `JWT_SECRET`   | Secret used to sign/verify JWTs (use a long random string in production) |

These are passed to Lambda via `serverless.yml` under `provider.environment`. Set them in your shell (or in `.env` when using `serverless dev`) before deploy.

---

## Database (Neon + Drizzle)

- Schema is defined in `src/db/schema.ts` (e.g. `usersTable`).
- The Drizzle client in `src/db/index.ts` uses `@neondatabase/serverless` with `drizzle-orm/neon-http` (see [Drizzle + Neon](https://orm.drizzle.team/docs/get-started-postgresql#neon)).

**Apply schema to Neon:**

- **Push (dev):** `npm run db:push` — syncs schema to the database (no migration files).
- **Migrate:** `npm run db:migrate` — runs migrations in `drizzle/`.
- **Generate migration:** `npm run db:generate` — creates a new migration from schema changes.
- **Studio:** `npm run db:studio` — open Drizzle Studio (optional).

---

## API endpoints

| Method | Path       | Auth  | Description |
|--------|------------|-------|-------------|
| GET    | `/status`  | No    | Health check |
| POST   | `/signup`  | No    | Create user; returns `accessToken` |
| POST   | `/login`   | No    | Login; returns `accessToken` |
| POST   | `/logout`  | Bearer | Logout (client should discard token) |
| DELETE | `/users/me`| Bearer | Soft-delete a user (see [Delete user](#delete-user) below) |

### GET /status

**Response (200):** `{ "status": "Server Online!" }`

### POST /signup

**Body:** `{ "name": "string", "email": "string", "password": "string" }` (password min 8 chars)

**Response (201):** `{ "accessToken": "..." }`  
**Errors:** 400 validation, 409 email already registered

### POST /login

**Body:** `{ "email": "string", "password": "string" }`

**Response (200):** `{ "accessToken": "..." }`  
**Errors:** 400 validation, 401 invalid email or password

### POST /logout

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200):** `{ "message": "Logged out successfully. Please discard the token on the client." }`  
**Errors:** 401 missing or invalid token

### Delete user

**Route:** `DELETE /users/me` (see `serverless.yml`; optional extra routes can pass `userId` / `id` in the path for admin flows.)

Soft-deletes the user row (`deleted_at` is set; the account can no longer log in). The JWT subject (`sub`) identifies who is calling.

**Who may delete**

| Caller | Allowed |
|--------|---------|
| `user.type === "admin"` | Yes (with the deployed route, the target is still the authenticated user; see note below). |
| Any active user deleting **their own** account | Yes (`target` defaults to the JWT user id). |

The controller resolves the **target user id** as: path parameter `userId` or `id` if present, otherwise the JWT user id. Today **`serverless.yml` only exposes `DELETE /users/me`**, so there are no path parameters and the target is always **your** user id. To let admins delete another user by id, add an HTTP API route (for example `DELETE /users/{userId}`) that maps to the same Lambda; API Gateway will populate `pathParameters.userId` and `DeleteUserController` will enforce **admin or self** on that id.

**Headers (required)**

```http
Authorization: Bearer <accessToken>
```

**Example (curl)**

Replace the URL with your deployed HTTP API host (from `serverless deploy` output).

```bash
curl -X DELETE \
  "https://<your-api-id>.execute-api.sa-east-1.amazonaws.com/users/me" \
  -H "Authorization: Bearer <accessToken>"
```

**Success (200)**

```json
{ "message": "User deleted successfully." }
```

**Errors**

| Status | When |
|--------|------|
| **401** | Missing/invalid token, or token refers to a missing / already soft-deleted account (`Invalid or inactive account.`). |
| **403** | Authenticated user is not an admin and is trying to delete someone else (`You do not have permission to delete this user.`). |
| **404** | Target user does not exist or was already soft-deleted (`User not found or already deleted.`). |

---

## Types and utilities

### Types (`src/types/Http.ts`)

- **HttpRequest** – `body`, `queryParams`, `params` (parsed from the API Gateway event).
- **ProtectedHttpRequest** – `HttpRequest` plus `userId` (JWT `sub` after `parseProtectedEvent`).
- **HttpResponse** – `statusCode` and optional `body` (plain object).

### HTTP helpers (`src/utils/http.ts`)

- `ok(body?)` → 200  
- `created(body?)` → 201  
- `badRequest(body?)` → 400  
- `unauthorized(body?)` → 401  
- `forbidden(body?)` → 403  
- `conflict(body?)` → 409  
- `notFound(body?)` → 404  

### Event/response parsing

- **parseEvent(event)** – Maps `APIGatewayProxyEventV2` to `HttpRequest` (body, path params, query params).
- **parseProtectedEvent(event)** – Like `parseEvent` but requires `Authorization: Bearer <token>` and sets `userId` from the JWT (throws if missing/invalid).
- **parseResponse(response)** – Maps `HttpResponse` to the Lambda return shape (`statusCode` + JSON string for `body`).

---

## Development

### Prerequisites

- Node.js 20.x
- [Serverless Framework](https://www.serverless.com/framework/docs/getting-started) (e.g. `npm i -g serverless`)
- AWS credentials configured (e.g. `serverless config credentials` or environment variables)

### Install dependencies

```bash
npm install
```

### Database setup

1. Create a project and database in [Neon](https://console.neon.tech) and copy the connection string.
2. Put it in `.env` as `DATABASE_URL` and set `JWT_SECRET` to a long random string.
3. Apply the schema: `npm run db:push` (or `npm run db:migrate`).

### Deploy

Ensure `DATABASE_URL` and `JWT_SECRET` are set in your environment (or in `.env` when using `serverless dev`). Then:

```bash
serverless deploy
```

After deploy, the CLI prints the base URL and all endpoints. Example:

```
endpoint: GET - https://xxxxxxxxxx.execute-api.sa-east-1.amazonaws.com/status
endpoint: POST - https://xxxxxxxxxx.execute-api.sa-east-1.amazonaws.com/signup
...
```

### Invoke the API

```bash
curl https://<your-api-id>.execute-api.sa-east-1.amazonaws.com/status
```

### Local development

Run the local Lambda emulator and develop against it:

```bash
serverless dev
```

Then call the same URL (or the local URL shown by the CLI). Changes are reflected without redeploying. When done, run `serverless deploy` to update the cloud stack.

---

## Configuration

- **Org:** `luxkas`
- **Service:** `paintresLumiere-api`
- **Provider:** AWS, `nodejs20.x`, `arm64`, region `sa-east-1`

The API is public after deployment. For production, consider adding an authorizer (e.g. JWT or IAM) via the [Serverless HTTP API events docs](https://www.serverless.com/framework/docs/providers/aws/events/http-api).

---

## Summary

The API provides a **GET /status** health check and **authentication**: signup, login, logout, and delete user. Auth uses JWT access tokens; protected routes (`/logout`, `DELETE /users/me`) require the `Authorization: Bearer <accessToken>` header. Delete is allowed for **admins** or when deleting **your own** account (see [Delete user](#delete-user)). The database is Neon (Postgres) with Drizzle ORM; schema lives in `src/db/schema.ts`. New endpoints can be added by defining functions and events in `serverless.yml` and implementing handlers and controllers under `src/functions` and `src/controllers`.
