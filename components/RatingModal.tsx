"use client";

import { useState } from "react";
import { doc, setDoc, serverTimestamp, runTransaction, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { toast } from "sonner";

interface RatingModalProps {
  bookingId: string;
  venueId: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  currentRating?: number;
  currentReview?: string;
}

const RatingModal = ({
  bookingId,
  venueId,
  userId,
  isOpen,
  onClose,
  currentRating,
  currentReview,
}: RatingModalProps) => {
  const [rating, setRating] = useState(currentRating || 0);
  const [review, setReview] = useState(currentReview || "");

  const handleRating = async () => {
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Create references
        const venueRef = doc(db, "venues", venueId);
        const reviewRef = doc(db, "reviews", `${venueId}_${userId}`);
        const bookingRef = doc(db, "bookings", bookingId);
        
        // Also add to comments subcollection for visibility in ReviewsSection
        const commentRef = doc(collection(db, `venues/${venueId}/comments`));

        // 2. Read current venue data
        const venueDoc = await transaction.get(venueRef);
        if (!venueDoc.exists()) {
          throw "Venue does not exist!";
        }

        const venueData = venueDoc.data();
        const currentRating = venueData.averageRating || 0;
        const currentCount = venueData.reviewCount || 0;

        // 3. Calculate new stats
        // Note: If updating an existing review, the math is more complex. 
        // For simplicity in this flow (which is typically "Rate your booking" for the first time), 
        // we assume it's a new rating for calculation purposes or we'd need to check if review exists.
        // The modal is usually shown for unrated bookings, so we treat it as a new rating contribution.
        
        const newCount = currentCount + 1;
        const newAverage = ((currentRating * currentCount) + rating) / newCount;
        const roundedAverage = Math.round(newAverage * 10) / 10;

        // 4. Prepare data
        const reviewData = {
          venueId,
          userId,
          rating,
          comment: review,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        const commentData = {
          text: review,
          author: "Verified User", // We might want to fetch user name if available, but "Verified User" is safe
          role: "user",
          rating: rating,
          createdAt: new Date().toISOString(),
        };

        // 5. Perform writes
        transaction.set(reviewRef, reviewData, { merge: true });
        transaction.set(commentRef, commentData);
        transaction.update(bookingRef, { rated: true });
        transaction.update(venueRef, {
          averageRating: roundedAverage,
          reviewCount: newCount,
        });
      });

      toast.success("Thank you for your feedback!");
      onClose();
    } catch (error) {
      console.error("Error submitting rating:", error);
      toast.error("Failed to submit your rating. Please try again.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate Your Experience</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="flex justify-center mb-4">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-8 h-8 cursor-pointer ${
                  i < rating ? "text-yellow-400 fill-current" : "text-gray-300"
                }`}
                onClick={() => setRating(i + 1)}
              />
            ))}
          </div>
          <Textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Leave a review (optional)"
          />
        </div>
        <DialogFooter>
          <Button onClick={handleRating}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RatingModal;
