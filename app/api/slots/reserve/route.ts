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
    const { slotId, venueId, customerName, customerPhone, notes } = body;

    if (!slotId || !venueId || !customerName || !customerPhone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

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

    const result = await db.runTransaction(async (tx) => {
      const slotRef = db.collection("slots").doc(slotId);
      const slotSnap = await tx.get(slotRef);
      if (!slotSnap.exists) throw { status: 404, message: "Slot not found" };

      const slotData = slotSnap.data() as any;
      const status = (slotData.status || "").toString().toUpperCase();
      if (status === "BOOKED") throw { status: 409, message: "Slot already booked" };

      const bookingRef = db.collection("bookings").doc();
      const bookingData: any = {
        venueId,
        slotId,
        date: slotData.date,
        startTime: slotData.startTime,
        timeSlot: `${slotData.date} ${slotData.startTime} - ${slotData.endTime || ""}`,
        customerName,
        customerPhone,
        notes: notes || null,
        bookingType: "physical",
        status: "confirmed",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      tx.set(bookingRef, bookingData);

      tx.update(slotRef, {
        status: "RESERVED",
        bookingId: bookingRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { bookingId: bookingRef.id };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("/api/slots/reserve error:", err);
    if (err && err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
