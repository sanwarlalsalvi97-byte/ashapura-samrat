# Attendance Face Scan, Worker Photos, and Public Pages

## Goal
Make Face Scan available where daily attendance is marked, add secure worker profile photos during registration, and restore public Landing and Terms pages.

## Changes

1. **Attendance Board Face Scan**
   - Add a clear Face Scan action beside the manual/GPS attendance controls on the daily Attendance page.
   - Reuse the existing camera dialog and attendance photo storage flow rather than creating a second camera system.
   - Let the user select a worker, capture a live photo, collect current GPS/time, and save the verification record with that worker’s attendance.
   - Keep ordinary one-tap attendance as the primary path and keep Face Scan optional unless the office setting requires it.
   - Remove any duplicate Settings entry; the current Settings page has no direct Face Scan button, so no unrelated setting will be removed.

2. **Worker Registration Photo**
   - Add a camera/gallery photo field to “मजदूर जोड़ें,” with preview, replace, and remove controls.
   - Create a private worker-photo storage bucket with owner-only upload/read/delete policies.
   - Add a nullable photo reference to each worker record and upload the selected image after the worker is created.
   - Clean up a newly created worker if its required photo-save step fails, avoiding incomplete records.
   - Display the saved photo in the worker list for identification.

3. **Public Landing and Terms**
   - Restore dedicated Landing and Terms pages.
   - Route `/` to the public Landing page, `/terms` to public Terms, and `/app` to the existing login/dashboard flow.
   - Keep PIN protection only around the private app area so visitors can read public information without signing in.
   - Link Login/Dashboard, Privacy Policy, and Terms from the public page.

4. **Verification**
   - Run TypeScript checks and the production web build.
   - Verify public routes and the worker photo/attendance controls in desktop and mobile-sized browser views.
   - Check the latest preview build diagnostics after changes.

## Technical Details
- Extend `public.workers` with `photo_url text` through a migration; preserve all existing worker data and policies.
- Store only private object paths in worker records, never public URLs.
- Use short-lived signed URLs when rendering worker photos.
- Reuse the existing `attendance-photos` bucket for attendance verification images and create a separate private `worker-photos` bucket for profile images.
