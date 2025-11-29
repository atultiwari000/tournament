import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { db, auth, isAdminInitialized } from "@/lib/firebase-admin";

async function callerIsManagerOrAdmin(uid: string) {
  try {
    const doc = await db.collection("users").doc(uid).get();
    if (!doc.exists) return false;
    const r = doc.data()?.role;
    return r === "manager" || r === "admin";
  } catch (e) {
    console.warn("Failed to check caller role", e);
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminInitialized()) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { slotId, bookingId, venueId } = body;
    if (!slotId || !bookingId || !venueId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

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
    const allowed = await callerIsManagerOrAdmin(uid);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await db.runTransaction(async (tx) => {
      const bookingRef = db.collection("bookings").doc(bookingId);
      const slotRef = db.collection("slots").doc(slotId);

      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists) throw { status: 404, message: "Booking not found" };

      const bookingData = bookingSnap.data() as any;
      if (bookingData.bookingType !== "physical") throw { status: 400, message: "Only physical bookings can be removed by manager" };

      tx.delete(bookingRef);
      tx.update(slotRef, { status: "AVAILABLE", bookingId: admin.firestore.FieldValue.delete(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("/api/slots/unbook error:", err);
    if (err && err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
