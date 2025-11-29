import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { db, auth, isAdminInitialized } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  if (!isAdminInitialized()) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { venueId, slotId } = body;

    if (!venueId || !slotId) {
      return NextResponse.json({ error: "Missing required fields: venueId, slotId" }, { status: 400 });
    }

    // Authenticate user via Bearer token (Firebase ID token)
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

    // Run transaction: ensure slot is available, create booking, update slot
    const result = await db.runTransaction(async (tx) => {
      const slotRef = db.collection("slots").doc(slotId);
      const slotSnap = await tx.get(slotRef);
      if (!slotSnap.exists) {
        throw { status: 404, message: "Slot not found" };
      }

      const slotData = slotSnap.data() as any;
      const status = (slotData.status || "").toString().toLowerCase();
      if (status && status !== "available") {
        throw { status: 409, message: "Slot is not available" };
      }

      // Get venue price if available
      const venueRef = db.collection("venues").doc(venueId);
      const venueSnap = await tx.get(venueRef);
      const pricePerHour = venueSnap.exists ? (venueSnap.data()?.pricePerHour || 0) : 0;

      const date = slotData.date || null;
      const startTime = slotData.startTime || null;
      const endTime = slotData.endTime || null;
      const timeSlot = date && startTime
        ? `${date} ${startTime} - ${endTime ?? ""}`
        : null;

      const bookingRef = db.collection("bookings").doc();
      const bookingData: any = {
        venueId,
        userId: uid,
        slotId,
        timeSlot,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        amount: pricePerHour,
      };

      tx.set(bookingRef, bookingData);

      tx.update(slotRef, {
        status: "booked",
        bookingId: bookingRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { bookingId: bookingRef.id };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("/api/bookings error:", err);
    if (err && err.status) {
      return NextResponse.json({ error: err.message || "Failed" }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
