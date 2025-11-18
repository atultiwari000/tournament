"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { NoVenueAccess } from "@/components/manager/NoVenueAccess";
import ManagerPanel from "@/components/ManagerPanel";

const MyVenuesPage = () => {
  const { user } = useAuth();
  const [venue, setVenue] = useState<any | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasVenueAccess, setHasVenueAccess] = useState<boolean | null>(null);

  const fetchVenueDetails = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const venuesQuery = query(
        collection(db, "venues"),
        where("managedBy", "==", user.uid)
      );
      const venueSnapshot = await getDocs(venuesQuery);

      if (venueSnapshot.empty) {
        setHasVenueAccess(false);
        setLoading(false);
        return;
      }

      setHasVenueAccess(true);
      const venueDoc = venueSnapshot.docs[0];
      const fetchedVenueId = venueDoc.id;
      setVenueId(fetchedVenueId);

      // Fetch the full venue data
      const venueRef = doc(db, "venues", fetchedVenueId);
      const venueDocSnap = await getDoc(venueRef);
      
      if (venueDocSnap.exists()) {
        setVenue({ id: fetchedVenueId, ...venueDocSnap.data() });
      }
    } catch (error) {
      console.error("Error fetching venue details:", error);
      setHasVenueAccess(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchVenueDetails();
  }, [fetchVenueDetails]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (hasVenueAccess === false) {
    return <NoVenueAccess />;
  }

  if (!venue) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-600">Loading venue data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Venue</h1>
        <p className="text-gray-600 mt-1">Manage your venue details, images, location, and availability.</p>
      </div>
      <ManagerPanel venue={venue} />
    </div>
  );
};

export default MyVenuesPage;

      if (venueSnapshot.empty) {
        setHasVenueAccess(false);
        setLoading(false);
        return;
      }

      setHasVenueAccess(true);

      const venueDoc = venueSnapshot.docs[0];
      setVenueId(venueDoc.id);
      const venueData = venueDoc.data();
      setVenue(venueData);
      setFormData({
        name: venueData.name || "",
        address: venueData.address || "",
        price: venueData.price ? venueData.price.toString() : "",
      });
    } catch (err: any) {
      console.error("Error fetching venue details:", err);
      toast.error("Failed to load venue details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchVenueDetails();
    }
  }, [user, fetchVenueDetails]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venueId) return;

    setIsUpdating(true);
    try {
      const priceAsNumber = parseFloat(formData.price);
      if (isNaN(priceAsNumber) || priceAsNumber < 0) {
        throw new Error("Please enter a valid, non-negative price.");
      }

      const venueRef = doc(db, "venues", venueId);
      await updateDoc(venueRef, {
        name: formData.name,
        address: formData.address,
        price: priceAsNumber,
      });

      toast.success("Venue details updated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update details.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" /> Loading settings...
      </div>
    );
  }

  if (hasVenueAccess === false) {
    return <NoVenueAccess />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Venue Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Update Your Venue Details</CardTitle>
          <CardDescription>
            Keep your venue information up to date for your customers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateDetails} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Venue Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="E.g., Downtown Futsal"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="E.g., 123 Main St, Anytown"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price Per Slot (in Rs.)</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={handleInputChange}
                placeholder="E.g., 1500"
                required
              />
            </div>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default VenueSettingsPage;
