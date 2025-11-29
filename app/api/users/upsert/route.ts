import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { db, auth, isAdminInitialized } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  if (!isAdminInitialized()) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { displayName, email, photoURL, role } = body;

    // Authenticate user
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

    // Determine role: default to 'user'. Only allow assigning 'manager' if caller is admin.
    let assignedRole = "user";
    if (role === "manager") {
      // Check if caller has admin privileges by reading users/{callerUid}
      try {
        const callerDoc = await db.collection("users").doc(uid).get();
        const callerRole = callerDoc.exists ? callerDoc.data()?.role : null;
        if (callerRole === "admin") {
          assignedRole = "manager";
        }
      } catch (err) {
        console.warn("Failed to verify caller role for manager assignment", err);
      }
    }

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    const base: any = {
      email: email || decoded.email || null,
      displayName: displayName || decoded.name || null,
      photoURL: photoURL || decoded.picture || null,
      lastSeen: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (!snap.exists) {
      await userRef.set({ ...base, role: assignedRole, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    } else {
      await userRef.set(base, { merge: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("/api/users/upsert error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
