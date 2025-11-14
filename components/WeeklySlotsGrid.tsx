"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const WeeklySlotsGrid = () => {
  const { user } = useAuth();
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [isSlotUpdateDialogOpen, setIsSlotUpdateDialogOpen] = useState(false);
  const [isGenerateSlotsDialogOpen, setIsGenerateSlotsDialogOpen] =
    useState(false);
  const [generatingSlots, setGeneratingSlots] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("21:00");
  const [groundId, setGroundId] = useState<string | null>(null);

  const fetchManagerData = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        setError("Your user profile was not found.");
        return;
      }

      const userData = userDoc.data();
      const userGroundId = userData.groundId;
      setGroundId(userGroundId);

      if (!userGroundId) {
        setError(
          'You are a manager but have no ground assigned. Please add a ground from the "Venue Map" tab.'
        );
        setSlots([]);
        return;
      }

      const groundDocRef = doc(db, "venues", userGroundId);
      const groundDoc = await getDoc(groundDocRef);
      if (
        groundDoc.exists() &&
        groundDoc.data().startTime &&
        groundDoc.data().endTime
      ) {
        const { startTime, endTime } = groundDoc.data();
        setStartTime(startTime);
        setEndTime(endTime);
      }

      const today = new Date();
      const dates = [...Array(7)].map((_, i) => {
        const date = new Date();
        date.setDate(today.getDate() + i);
        return date.toISOString().split("T")[0];
      });

      const slotsQuery = query(
        collection(db, "slots"),
        where("groundId", "==", userGroundId),
        where("date", "in", dates)
      );

      const slotsSnapshot = await getDocs(slotsQuery);
      const slotsData = slotsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSlots(slotsData);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("An error occurred while fetching your data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchManagerData();
    }
  }, [user]);

  const handleSlotClick = (slot: any) => {
    if (slot) {
      setSelectedSlot(slot);
      setIsSlotUpdateDialogOpen(true);
    }
  };

  const handleUpdateSlotStatus = async (status: string) => {
    if (!selectedSlot) return;

    try {
      const slotRef = doc(db, "slots", selectedSlot.id);
      await updateDoc(slotRef, { status });
      toast.success(`Slot status updated to ${status}`);
      setIsSlotUpdateDialogOpen(false);
      fetchManagerData();
    } catch (error) {
      console.error("Error updating slot status:", error);
      toast.error("Failed to update slot status");
    }
  };

  const handleGenerateSlots = async () => {
    if (!groundId) {
      toast.error("Cannot generate slots without an assigned ground.");
      return;
    }

    setGeneratingSlots(true);
    const batch = writeBatch(db);

    try {
      const weekDates = [...Array(7)].map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        return date;
      });

      const startHour = parseInt(startTime.split(":")[0], 10);
      const endHour = parseInt(endTime.split(":")[0], 10);

      weekDates.forEach((date) => {
        for (let hour = startHour; hour < endHour; hour++) {
          const slotTime = `${hour.toString().padStart(2, "0")}:00`;
          const dateString = date.toISOString().split("T")[0];
          const newSlotRef = doc(collection(db, "slots"));
          batch.set(newSlotRef, {
            groundId: groundId,
            date: dateString,
            startTime: slotTime,
            status: "AVAILABLE",
            createdAt: new Date().toISOString(),
          });
        }
      });

      const groundDocRef = doc(db, "venues", groundId);
      batch.update(groundDocRef, { startTime, endTime });

      await batch.commit();
      toast.success("Weekly slots have been generated successfully!");
      setIsGenerateSlotsDialogOpen(false);
      fetchManagerData();
    } catch (err) {
      console.error("Failed to generate slots", err);
      toast.error("An error occurred while generating slots.");
    } finally {
      setGeneratingSlots(false);
    }
  };

  const today = new Date();
  const weekDates = [...Array(7)].map((_, i) => {
    const date = new Date();
    date.setDate(today.getDate() + i);
    return date;
  });

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const gridHours = (() => {
    const start = parseInt(startTime.split(":")[0], 10);
    const end = parseInt(endTime.split(":")[0], 10);
    return Array.from(
      { length: end - start },
      (_, i) => `${(start + i).toString().padStart(2, "0")}:00`
    );
  })();

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-500 bg-red-50 border border-red-200 rounded-md">
        {error}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground mb-4">
          No slots found for your assigned ground.
        </p>
        <Button onClick={() => setIsGenerateSlotsDialogOpen(true)}>
          Generate Weekly Slots
        </Button>

        <Dialog
          open={isGenerateSlotsDialogOpen}
          onOpenChange={setIsGenerateSlotsDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Weekly Slots</DialogTitle>
              <DialogDescription>
                Define the operating hours for your venue. This will create
                available slots for the next 7 days and save these hours for
                future use.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="start-time" className="text-right">
                  Start Time
                </label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="end-time" className="text-right">
                  End Time
                </label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleGenerateSlots} disabled={generatingSlots}>
                {generatingSlots ? "Generating..." : "Generate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-8 gap-1 text-center text-sm overflow-x-auto">
        <div className="font-bold"></div>
        {weekDates.map((date) => (
          <div key={date.toISOString()} className="font-bold py-2">
            <div>{days[date.getDay()]}</div>
            <div className="text-xs text-muted-foreground">
              {date.getDate()}
            </div>
          </div>
        ))}

        {gridHours.map((hour) => {
          const currentHour = parseInt(hour.split(":")[0], 10);
          const nextHour = currentHour + 1;
          const hourLabel = `${currentHour
            .toString()
            .padStart(2, "0")}:00 - ${nextHour.toString().padStart(2, "0")}:00`;

          return (
            <React.Fragment key={hour}>
              <div className="font-bold py-2 whitespace-nowrap">
                {hourLabel}
              </div>
              {weekDates.map((date) => {
                const dateString = date.toISOString().split("T")[0];
                const slot = slots.find(
                  (s) => s.date === dateString && s.startTime === hour
                );

                let cellContent = " ";
                let cellClass = "bg-gray-100 border";

                if (slot) {
                  switch (slot.status) {
                    case "AVAILABLE":
                      cellClass =
                        "bg-green-200 hover:bg-green-300 cursor-pointer border";
                      cellContent = "Available";
                      break;
                    case "BOOKED":
                      cellClass = "bg-yellow-400 border cursor-not-allowed";
                      cellContent = "Booked";
                      break;
                    case "RESERVED":
                      cellClass =
                        "bg-orange-400 hover:bg-orange-500 cursor-pointer border";
                      cellContent = "Reserved";
                      break;
                    case "BLOCKED":
                      cellClass =
                        "bg-red-400 hover:bg-red-500 cursor-pointer border";
                      cellContent = "Blocked";
                      break;
                    default:
                      break;
                  }
                }

                return (
                  <div
                    key={date.toISOString()}
                    className={`p-2 rounded-md ${cellClass}`}
                    onClick={() => handleSlotClick(slot)}
                  >
                    {cellContent}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
      <Dialog
        open={isSlotUpdateDialogOpen}
        onOpenChange={setIsSlotUpdateDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Slot Status</DialogTitle>
          </DialogHeader>
          {selectedSlot && (
            <p className="py-4">
              Slot: {selectedSlot.date} at {selectedSlot.startTime}
            </p>
          )}
          <DialogFooter className="sm:justify-start">
            <Button
              onClick={() => handleUpdateSlotStatus("AVAILABLE")}
              variant="outline"
            >
              Available
            </Button>
            <Button
              onClick={() => handleUpdateSlotStatus("RESERVED")}
              variant="outline"
            >
              Reserved
            </Button>
            <Button
              onClick={() => handleUpdateSlotStatus("BLOCKED")}
              variant="destructive"
            >
              Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WeeklySlotsGrid;
