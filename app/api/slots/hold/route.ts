import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { db, auth, isAdminInitialized } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  if (!isAdminInitialized()) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { slotId, venueId, holdDurationMinutes = 5 } = body;

    if (!slotId || !venueId) {
      return NextResponse.json({ error: "Missing required fields: slotId, venueId" }, { status: 400 });
    }

    // Authenticate user via Bearer token
    const authHeader = request.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer (.*)$/);
    if (!match) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const idToken = match[1];

    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (err) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const uid = decoded.uid;

    const result = await db.runTransaction(async (tx) => {
      const slotRef = db.collection("slots").doc(slotId);
      const slotSnap = await tx.get(slotRef);
      if (!slotSnap.exists) throw { status: 404, message: "Slot not found" };

      const slotData = slotSnap.data() as any;
      const status = (slotData.status || "").toString().toUpperCase();

      // Check if held/booked
      if (status && status !== "AVAILABLE") {
        // If HELD but expired, allow; otherwise reject
        if (status !== "HELD") throw { status: 409, message: "Slot not available" };
        const expires = slotData.holdExpiresAt;
        if (expires && expires.toMillis && expires.toMillis() > admin.firestore.Timestamp.now().toMillis()) {
          throw { status: 409, message: "Slot currently held" };
        }
      }

      const now = admin.firestore.Timestamp.now();
      const holdExpiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + holdDurationMinutes * 60 * 1000);

      const bookingRef = db.collection("bookings").doc();
      const bookingData: any = {
        venueId,
        userId: uid,
        slotId,
        status: "PENDING_PAYMENT",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        bookingExpiresAt: holdExpiresAt,
      };

      tx.set(bookingRef, bookingData);

      tx.update(slotRef, {
        status: "HELD",
        heldBy: uid,
        holdExpiresAt,
        bookingId: bookingRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { bookingId: bookingRef.id };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("/api/slots/hold error:", err);
    if (err && err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
