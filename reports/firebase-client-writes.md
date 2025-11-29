# Firebase Client-Side Write Audit

Date: 2025-11-29

Summary
-------
- Purpose: locate all places where the client (browser) directly performs writes to Firestore / Realtime DB in this repository.
- Goal: make it easy to migrate write operations to backend endpoints (server functions / API routes) while allowing reads to remain client-side where appropriate.

Methodology
-----------
- Searched for common client write APIs: `setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, `runTransaction`, `writeBatch`, `.set(` on Firestore refs, `arrayUnion`, `arrayRemove`, and `.push`.
- Filtered results to files that include `"use client"` or live under client folders (`components/`, `app/` pages that are client), and inspected each file to confirm writes are client-originated.

High-level findings
-------------------
- Many user-facing operations are done directly from client code; these include bookings, slot holds, slot generation, venue creation, user upserts, reviews/ratings, and various admin actions.
- The `lib/slotService.ts` exposes many write-capable functions (initialize/update/book/hold/release/reserve...). Several client components call these functions directly — meaning complex transactional writes are initiated from the browser.
- Some important server-side-only flows exist under `app/api/...` (e.g. payment verification) — these are fine and already perform writes server-side.

Inventory — client-side writes
-----------------------------
Each entry lists: file path, why it's client, write APIs used, and a short code snippet.

1) `components/BookingForm.tsx` (client)
   - APIs: `setDoc` (create booking), `updateDoc` (update slot status), `serverTimestamp`.
   - Location: `handleBooking` handler.
   - Snippet:
     ```tsx
     const bookingRef = doc(collection(db, "bookings"));
     await setDoc(bookingRef, { venueId, userId: user.uid, status: "pending", createdAt: serverTimestamp() });
     const slotRef = doc(db, "slots", selectedTimeSlotId);
     await updateDoc(slotRef, { status: "booked" });
     ```
   - Why migrate: bookings should be created server-side to enforce pricing, idempotency, race-safety and to avoid exposing business logic or client-side trust issues.

2) `components/register-form.tsx` (client)
   - APIs: `setDoc`, `getDoc`, `serverTimestamp`.
   - Location: `safeUpsertUserDoc` called after auth flows.
   - Snippet:
     ```tsx
     const userRef = doc(db, "users", uid);
     const snap = await getDoc(userRef);
     if (!snap.exists()) {
       await setDoc(userRef, { ...base, role, createdAt: serverTimestamp() });
     } else {
       await setDoc(userRef, base, { merge: true });
     }
     ```
   - Why migrate: user metadata upserts are OK client-side after auth, but moving to backend can centralize role assignment rules and validation.

3) `components/WeeklySlotsGrid.old.tsx` (client)
   - APIs: `runTransaction`, `transaction.set`, `addDoc`, `writeBatch`, `batch.set`, `transaction.delete`, `setDoc`.
   - Locations: `handleHoldSlot`, `handleReserveSlot`, `handleGenerateSlots`, manager dialogs.
   - Snippet (hold + create booking):
     ```tsx
     await runTransaction(db, async (transaction) => {
       transaction.set(slotDocRef, { status: "HELD", heldBy: user.uid, holdExpiresAt: fiveMinutesFromNow }, { merge: true });
       const bookingDocRef = doc(collection(db, "bookings"));
       transaction.set(bookingDocRef, { userId: user.uid, status: "PENDING_PAYMENT", createdAt: serverTimestamp() });
     });
     ```
   - Why migrate: transactional slot holds/pay flows should be server-controlled (prevent client race conditions and cheating). Complex batch writes and transactions are better protected server-side.

4) `components/SlotEditor.old.tsx` and `components/SlotEditor.tsx` (client)
   - APIs: `addDoc`, `deleteDoc`, `updateDoc`, calls to `initializeVenueSlots()` and `updateSlotConfig()` from `lib/slotService`.
   - Snippet (old add):
     ```tsx
     await addDoc(collection(db, "slots"), { groundId: venueId, date, startTime, status: "available", createdAt: serverTimestamp() });
     ```
   - Snippet (new editor uses service):
     ```ts
     await initializeVenueSlots(venueId, config);
     ```
   - Why migrate: slot config initialisation and slot mutations should be validated and authorized server-side to avoid corrupting schedule state.

5) `components/addGround.tsx` (client)
   - APIs: `addDoc(collection(db, "venues"))` and then `initializeVenueSlots(newVenueRef.id, config)` from `lib/slotService`.
   - Snippet:
     ```tsx
     const newVenueRef = await addDoc(collection(db, "venues"), { name, latitude, managedBy: user.uid, createdAt: new Date().toISOString() });
     await initializeVenueSlots(newVenueRef.id, { startTime, endTime, slotDuration, daysOfWeek });
     ```
   - Why migrate: venue creation is a privileged operation (managedBy, pricing) — should be an authenticated backend API to prevent fraudulent managedBy values and to centralize initialization logic.

6) `components/ReviewsSection.tsx` (client)
   - APIs: `runTransaction` with `transaction.set` to `venues/{id}/comments`, `reviews/{venueId_userId}`, and `transaction.update` on `venues/{id}` to update `averageRating` & `reviewCount`.
   - Snippet:
     ```tsx
     await runTransaction(db, async (transaction) => {
       const venueRef = doc(db, "venues", venueId);
       transaction.set(commentRef, commentData);
       transaction.set(reviewRef, reviewData, { merge: true });
       transaction.update(venueRef, { averageRating: roundedAverage, reviewCount: newCount });
     });
     ```
   - Why migrate: rating calculations and constraints (one review per user, abuse prevention) are safer server-side.

7) `components/RatingModal.tsx` (client)
   - APIs: `runTransaction` (same pattern as ReviewsSection), `transaction.update` booking rated flag.
   - Why migrate: same rationale as above.

8) `components/ManagerPanel.tsx` (client)
   - APIs: `updateDoc(doc(db, "venues", venueId))` to save venue edits.
   - Snippet:
     ```tsx
     await updateDoc(venueRef, { name, description, pricePerHour, imageUrls, attributes, updatedAt: serverTimestamp() });
     ```
   - Why migrate: manager edits should be validated server-side (permission checks already exist in UI but server rules are stronger).

9) `app/tester/page.tsx` (client)
   - APIs: `addDoc` (venues, bookings), `deleteDoc` (bulk deletes) — intentionally a dev/test page.
   - Why migrate: this page is for development only; remove or protect before production.

10) `app/admin/venues/page.tsx` (client)
    - APIs: `addDoc`, `updateDoc`, `deleteDoc` for `venues`.
    - Why migrate: admin operations should be server-side or protected via secure endpoints / auth checks.

11) `app/admin/bookings/page.tsx`, `app/admin/overview/page.tsx` (client)
    - APIs: `updateDoc(doc(db, "bookings", id))` to change booking statuses (approve/reject).
    - Why migrate: approve/reject actions are business-critical; moving to backend prevents tampering and enables audit logs.

12) `app/admin/users/page.tsx` (client)
    - APIs: `updateDoc(doc(db, "users", id))` (toggle role), `deleteDoc(doc(db, "users", id))`.
    - Why migrate: role changes must be server-authorized and audited.

13) `app/admin/managers/[id]/page.tsx` (client)
    - APIs: `updateDoc(doc(db, "users", id))` for limit changes, `addDoc(collection(db, "payouts"))` for recording payouts.
    - Why migrate: payouts and limits need server-side validation and consistent accounting.

14) `app/user/bookings/page.tsx` (client)
    - APIs: `updateDoc` to set booking status to `not_found` and `verificationFailedAt` when payment verification fails; this is invoked after calling the server `/api/payment/verify` which already does server-side confirmation in many flows.
    - Note: this is a hybrid flow — verification is server-side but the client records a fallback status. Prefer the server to update booking status and return updated booking to the client.

15) `lib/slotService.ts` (library called by clients)
    - APIs inside the file: `setDoc`, `updateDoc`, `runTransaction`, `arrayUnion`, `arrayRemove`, `Timestamp`, `serverTimestamp`.
    - Functions: `initializeVenueSlots`, `getVenueSlots`, `bookSlot`, `holdSlot`, `releaseHold`, `reserveSlot`, `blockSlot`, etc.
    - Why migrate: the service implements the domain model for slots and currently can be (and is) called from client components. Either this service must be moved to server-only code (use admin SDK) or a safe server wrapper API should be created which calls these functions in a controlled environment.

Server-side / safe-write examples (already server)
-----------------------------------------------
- `app/api/payment/verify/route.ts` — payment verification and logging happen server-side and call `logPayment()` in `lib/paymentLogger.ts`. Keep this pattern for sensitive flows.

Prioritised migration suggestions
--------------------------------
1. Booking creation and slot-hold flow (highest priority)
   - Why: money + race conditions + inventory. Convert `BookingForm` and `WeeklySlotsGrid` slot-hold/booking flows to server endpoints. Implement a POST `/api/bookings` that performs the transaction atomically (use Firestore transactions on the server). Return booking id and next steps (payment URL or redirect data).

2. Slot service functions called from client (`lib/slotService.ts`)
   - Move the service to server code (or create server wrappers) and expose a minimal REST/edge API for operations: `POST /api/slots/hold`, `POST /api/slots/book`, `POST /api/slots/release`, `POST /api/slots/generate`.

3. Venue create / initialize (`addGround`, `admin/venues`) — migrate to server-side `POST /api/venues` which enforces `managedBy` matches authenticated admin/manager and calls `initializeVenueSlots` internally.

4. Reviews / ratings — move write logic to server (`POST /api/venues/:id/reviews`) so rating aggregation, unique-review checks, and abuse protections are enforced centrally.

5. Admin actions (approve / reject / payouts / change roles) — must be server endpoints with strict auth/role checks and audit logs.

6. User upsert on registration — optionally keep a lightweight client upsert, but prefer a server endpoint that sets `role` and ensures consistent `createdAt` / default fields.

Recommended roadmap & next steps
--------------------------------
- Short term (1–2 days):
  - Implement `POST /api/bookings` and refactor `components/BookingForm.tsx` to call that endpoint.
  - Implement backend wrappers for `hold` and `book` flows; update `WeeklySlotsGrid` to call them.

- Medium term (1–2 weeks):
  - Move `lib/slotService.ts` to a server-only module (or create server wrappers) and ensure client calls go through API endpoints.
  - Move venue creation and admin write flows to server endpoints; add audit logging collection.

- Longer term:
  - Add integration tests (server) for transactional flows (booking, holds) to guard against race conditions.
  - Harden security rules and reduce client write permissions in Firestore rules to only allow reads and minimal writes.

Appendix — Notes & examples
---------------------------
- Example endpoint design for booking:
  - POST `/api/bookings` payload: { venueId, slotId, userId, paymentMethod, metadata }
  - Server action: run transaction -> verify slot availability, create booking doc, update inventory/slot status, return booking id and payment instructions.

- Example endpoint design for manager actions:
  - POST `/api/admin/venues/:id` (update) — authenticated + role check; record admin user in `updatedBy` and write an audit record in `adminActions` collection.

If you want I can:
- Generate a JSON/CSV with every client write occurrence with exact file+line ranges (useful for automated PRs).
- Start scaffolding the most important server endpoints (`/api/bookings`, `/api/slots/hold`, `/api/venues`) and refactor a single client component to call them as a working example.

Contact
-------
Report generated by the code assistant. Ask me which migration tasks to prioritize and I can open a PR to implement them.
