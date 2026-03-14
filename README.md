# Paintres Lumiere API

Backend API for **Paintres Lumiere**, built with the Serverless Framework on AWS (Lambda + API Gateway). The API is written in TypeScript and follows a controller-based structure with shared HTTP types and utilities.

---

## Tech stack

- **Runtime:** Node.js 20.x (ARM64)
- **Language:** TypeScript
- **Framework:** [Serverless Framework](https://www.serverless.com/) (AWS provider)
- **Region:** `sa-east-1`
- **API:** AWS Lambda + HTTP API (API Gateway v2)

---

## Project structure

```
paintresLumiere-api/
├── serverless.yml          # Service config, functions, and HTTP events
├── package.json
├── handler.js              # Legacy/example handler (not used by current routes)
└── src/
    ├── functions/          # Lambda entry points
    │   └── status.ts       # GET /status handler
    ├── controllers/        # Business logic per route/feature
    │   └── StatusController.ts
    ├── types/
    │   └── Http.ts         # HttpRequest, HttpResponse, ProtectedHttpRequest
    └── utils/
        ├── http.ts         # Response helpers (ok, created, badRequest, etc.)
        ├── parseEvent.ts   # API Gateway event → HttpRequest
        └── parseResponse.ts # HttpResponse → Lambda return format
```

---

## Architecture

1. **API Gateway** receives the HTTP request and invokes the Lambda function configured in `serverless.yml`.
2. **Function** (`src/functions/*.ts`) receives the raw event, optionally parses it with `parseEvent`, and calls the appropriate **controller**.
3. **Controller** returns an `HttpResponse` (status code + optional body) using helpers from `src/utils/http.ts`.
4. **parseResponse** turns that into the object Lambda/API Gateway expect (`statusCode` + stringified `body`).

Shared types in `src/types/Http.ts` keep requests and responses consistent across handlers and controllers.

---

## API endpoints

| Method | Path    | Handler              | Description                    |
|--------|---------|----------------------|--------------------------------|
| GET    | `/status` | `status.handler`   | Health check; returns server status |

### Example: GET /status

**Response (200):**

```json
{ "status": "Server Online!" }
```

---

## Types and utilities

### Types (`src/types/Http.ts`)

- **HttpRequest** – `body`, `queryParams`, `params` (parsed from the API Gateway event).
- **ProtectedHttpRequest** – `HttpRequest` plus `userId` (for future auth).
- **HttpResponse** – `statusCode` and optional `body` (plain object).

### HTTP helpers (`src/utils/http.ts`)

- `ok(body?)` → 200  
- `created(body?)` → 201  
- `badRequest(body?)` → 400  
- `unauthorized(body?)` → 401  
- `conflict(body?)` → 409  

### Event/response parsing

- **parseEvent(event)** – Maps `APIGatewayProxyEventV2` to `HttpRequest` (body, path params, query params).
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

### Deploy

```bash
serverless deploy
```

After deploy, the CLI prints the base URL and the `GET /status` endpoint. Example:

```
endpoint: GET - https://xxxxxxxxxx.execute-api.sa-east-1.amazonaws.com/status
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

This repo currently provides a single **GET /status** health endpoint and the foundation for more routes: controllers, shared HTTP types, response helpers, and event/response parsing. New endpoints can be added by defining functions and events in `serverless.yml` and implementing handlers and controllers under `src/functions` and `src/controllers`.
