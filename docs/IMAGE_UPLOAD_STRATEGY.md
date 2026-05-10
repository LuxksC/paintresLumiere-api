# Image Upload Strategy

This document explains how the Paintres Lumiere API handles image uploads, why it was designed this way, and what trade-offs that brings.

---

## The problem with uploading images through a Lambda

When a mobile app uploads an image, the most obvious approach is to send the image directly to the API. But there is a problem: **AWS Lambda has a 6 MB payload limit**. A single photo taken on a modern smartphone can easily exceed that. Even if it didn't, sending every image through a Lambda wastes compute time (you're paying for the Lambda while it just reads bytes) and memory.

The solution is to never let the image touch the Lambda at all.

---

## How it works: Presigned URLs

Instead of receiving the image, the API generates a **presigned upload URL** — a temporary, signed link that gives the mobile client permission to upload directly to the S3 bucket.

Here is the full flow, step by step:

```
Mobile App                   API (Lambda)              S3 Bucket              SQS Queue          Lambda (processProfileImage)
    |                             |                         |                      |                          |
    |-- GET /profile/image/upload-url -->                   |                      |                          |
    |                             |                         |                      |                          |
    |                     Validate request                  |                      |                          |
    |                     Generate signed URL               |                      |                          |
    |                             |                         |                      |                          |
    |<-- { url, fields, key } ----|                         |                      |                          |
    |                             |                         |                      |                          |
    |-- POST image to S3 (multipart/form-data) ------------>|                      |                          |
    |                             |                         |                      |                          |
    |                             |              S3 ObjectCreated event            |                          |
    |                             |                         |----> SQS message --->|                          |
    |                             |                         |                      |                          |
    |                             |                         |                      |-- SQS triggers Lambda -->|
    |                             |                         |                      |                          |
    |                             |                         |            Update users.image in DB             |
    |                             |                         |            Delete old S3 image (if any)         |
```

### Why this saves money

- The API Lambda only runs for ~50ms to generate a URL. No image bytes ever pass through it.
- The upload goes directly from the mobile device to S3 — the fastest and cheapest path.
- The `processProfileImage` Lambda only runs when a file actually lands in the bucket. It is not always running.

---

## The S3 bucket: one bucket, organized by prefix

All uploads go into a single S3 bucket: **`paintres-lumiere-uploads`**.

Files are organized using **key prefixes**, which work like folders:

```
paintres-lumiere-uploads/
  profile-images/{userId}/{uuid}.jpg    ← profile pictures
  svg-assets/{userId}/{uuid}.svg        ← future: user-uploaded SVG assets
```

### Why one bucket instead of many?

Each S3 bucket comes with its own set of configuration: permissions, event rules, lifecycle policies, CORS settings, and cost monitoring. Managing multiple buckets multiplies that overhead for no real benefit at this scale.

With prefixes, you get the same separation:

- **IAM policies** can be scoped to a prefix (`s3:PutObject` on `bucket/profile-images/*` only).
- **S3 event notifications** are filtered by prefix, so only `profile-images/` uploads trigger the profile image queue — SVG uploads (when added) will trigger their own queue.
- **Lifecycle rules** can archive or delete files under a specific prefix after a set number of days.

### How to add a new type of upload in the future

1. Pick a new prefix (e.g. `svg-assets/`).
2. Add a new SQS queue and event filter in `serverless.yml`.
3. Create a new queue processor Lambda.
4. Call `StorageService.getPresignedUpload()` from the new controller with the new prefix and options.

The `StorageService` already accepts `bucket`, `key`, `contentType`, and `maxFileSizeBytes` as parameters — nothing needs to change in the service itself.

---

## The SQS queue: why not process the image inside the S3 event Lambda directly?

When S3 detects a new file, it can trigger a Lambda directly. So why add a queue in the middle?

| Without SQS | With SQS |
|---|---|
| If the Lambda fails, the event is gone | Message stays in the queue and is retried automatically (up to 3 times) |
| No visibility into failed jobs | Failed messages go to a Dead Letter Queue (DLQ) for inspection |
| Adding more processing later requires changing the S3 trigger Lambda | The SQS consumer can be extended without touching infrastructure config |
| S3 event is fire-and-forget | SQS guarantees at-least-once delivery |

The S3 bucket is configured to send upload notifications **directly to SQS** (without a Lambda in the middle). This removes one Lambda hop from the foodiary pattern (`S3 → Lambda → SQS`) and makes delivery more reliable.

Each asset type (profile images, SVG assets) has its own queue. This means:
- A burst of failed SVG jobs does not block profile image processing.
- Each queue can have different visibility timeouts and scaling settings.
- Alarms can be set per queue to detect backlogs.

---

## Google accounts: letting Google handle storage

When a user signs in with Google, Google provides a **profile picture URL** directly in the ID token. There is no need to download that image and re-upload it to S3.

The API stores the Google-provided URL directly in `users.image`. The mobile app loads it from Google's CDN, which is:
- **Faster** — Google's CDN is globally distributed and optimized for image delivery.
- **Free** — no S3 storage or data transfer cost for the application.
- **Always up to date** — if the user changes their Google profile picture, the URL reflects that.

### Rules applied

| Situation | What happens |
|---|---|
| New user created via Google auth | `users.image` is set to the Google picture URL. No S3 upload ever needed. |
| User without Google auth uploads a profile picture | Image is stored in S3 under `profile-images/`. |
| User requests an upload URL but already has a Google account linked | Request is rejected with a 400 error. |
| User has an S3 profile image and then links their Google account | S3 image is **deleted** from the bucket. `users.image` is updated to the Google picture URL. |

The last rule is important for cost: S3 charges for storage by the gigabyte. Keeping orphaned images that are no longer needed would silently accumulate cost over time.

---

## File validation

Validation happens in two places:

**1. At the presigned URL level (enforced by S3 itself)**

When the API generates the presigned URL, it includes conditions in the signature:
- **Allowed content types:** `image/png`, `image/jpeg`, `image/jpg`, `image/heic`
- **Maximum file size:** 5 MB (`content-length-range` condition)

If the mobile client tries to upload a file that does not match these conditions, S3 rejects the upload without the API being involved at all.

5 MB was chosen as a reasonable upper bound for a profile picture. It is generous enough for high-resolution photos from modern phones but small enough to keep storage and transfer costs low.

**2. At the controller level**

Before generating the URL, the API validates:
- The user exists and is not soft-deleted.
- The user does not have a Google account linked (those users cannot upload to S3).
- The `contentType` query parameter is one of the allowed values.

---

## Known trade-offs and negative points

### The image update is asynchronous

After the mobile client uploads an image to S3, the `users.image` field in the database is not updated immediately. It is updated a few seconds later when the SQS consumer Lambda runs. If the client fetches `GET /profile` right after uploading, it may still see the old image URL.

**Mitigation:** The mobile app can show the locally selected image immediately (optimistic UI) while the background sync completes.

### Old S3 image deletion is best-effort

If the `processProfileImage` Lambda fails after updating the database but before deleting the old S3 image, the old file stays in the bucket. The SQS retry will re-run the processor, but if the database was already updated, the old key is no longer in `users.image` and will not be re-deleted.

**Mitigation:** An S3 lifecycle rule can be added to automatically delete any files in `profile-images/` that are older than a set number of days and are not referenced anywhere. This is a good future improvement.

### Google picture URLs can expire or change

Google profile picture URLs are controlled by Google and can change or expire. If a user updates their Google profile picture, the stored URL will become outdated.

**Mitigation:** Refresh `users.image` from the Google token each time the user signs in via `POST /auth/google`. This is a small improvement that can be added later.

### No image resizing or compression

Images are stored as uploaded. A 5 MB HEIC photo is stored as-is. If the mobile app displays thumbnails, it downloads the full 5 MB image every time.

**Mitigation:** The `processProfileImage` SQS consumer can be extended to resize and compress images (e.g. using the `sharp` library) before updating the database URL. The queue architecture already makes this easy to add.
