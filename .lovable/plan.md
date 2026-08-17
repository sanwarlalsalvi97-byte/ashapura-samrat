# Link मजदूर logins to a contractor's worker record

## Problem (confirmed)
A user who signs up as "मजदूर" gets a brand-new account with its own empty data space. Nothing connects that login to a worker row created by a contractor, so every worker screen (home, attendance, report, payment history) is blank. Workers also cannot add data because their view is read-only by design.

## Proposed approach: worker code invite
1. **Database**
   - Add `linked_user_id` (uuid, nullable, unique) to `workers`.
   - Add a security-definer function `link_worker_account(_worker_code text, _phone text)` that finds an active worker matching code + phone, sets `linked_user_id = auth.uid()` if unclaimed, and returns the worker id.
   - Add read-only RLS policies so a signed-in worker can `select` their own rows in `workers`, `attendance`, `attendance_logs`, `payment_history`, and `worker_expenses` where the worker is linked to `auth.uid()`.

2. **Onboarding screen**
   - After a worker-role login, if no linked worker exists, show a "अपना खाता जोड़ें" screen asking for the 4-digit worker code + phone, calling `link_worker_account`.
   - Clear error states for wrong code / already-claimed code.

3. **Data layer**
   - Add `getLinkedWorker()` helper and make worker-mode screens (HomePage, AttendancePage, ReportPage, PaymentHistory, Punch) query only that worker's data instead of the tenant-wide queries.
   - Worker mode hides workers-tab prompts like "पहले 'मजदूर' टैब में मजदूर जोड़ें".

4. **Contractor side**
   - Show each worker's code and link status in the worker list so contractors can share the code.

## Notes
This touches the database schema, RLS, and several screens, so it needs approval before implementation. No existing data is modified or deleted.
