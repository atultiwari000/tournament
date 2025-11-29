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

function getSlotId(groundId: string, date: string, startTime: string) {
  return `${groundId}_${date}_${startTime.replace(":", "")}`;
}

export async function POST(request: NextRequest) {
  if (!isAdminInitialized()) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { venueId, startTime, endTime, slotDuration = 60, days = 7 } = body;
    if (!venueId || !startTime || !endTime) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

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

    const batch = db.batch();

    const now = new Date();
    const dates = [...Array(days)].map((_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      return d.toISOString().split("T")[0];
    });

    const startHour = parseInt(startTime.split(":")[0], 10);
    const endHour = parseInt(endTime.split(":")[0], 10);

    for (const dateString of dates) {
      for (let hour = startHour; hour < endHour; hour += Math.max(1, Math.floor(slotDuration / 60))) {
        const hourString = `${hour.toString().padStart(2, "0")}:00`;
        const slotId = getSlotId(venueId, dateString, hourString);
        const slotRef = db.collection("slots").doc(slotId);
        batch.set(slotRef, { groundId: venueId, date: dateString, startTime: hourString, status: "AVAILABLE" }, { merge: true });
      }
    }

    const venueRef = db.collection("venues").doc(venueId);
    batch.update(venueRef, { startTime, endTime });

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("/api/slots/generate error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
