"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VenueMap from "@/components/venueMap";
import WeeklySlotsGrid from "@/components/WeeklySlotsGrid";

const ManagerDashboard = () => {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <Tabs defaultValue="slots" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="slots">Weekly Slots</TabsTrigger>
          <TabsTrigger value="map">Venue Map</TabsTrigger>
        </TabsList>
        <TabsContent value="slots">
          <WeeklySlotsGrid />
        </TabsContent>
        <TabsContent value="map">
          <VenueMap />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ManagerDashboard;
