# Slot System Refactor Plan

## Current Architecture Problems

### Issues:
1. **Document Explosion**: Each time slot = 1 Firestore document
   - 10 slots/day × 7 days = 70 documents/week per venue
   - 100 venues = 7,000 documents/week
   
2. **High Read Costs**: 
   - Fetching 1 week = 70 reads minimum
   - 1000 users/day × 70 reads = 70,000 reads/day (free tier: 50k/day)
   
3. **Redundant Data**: 
   - Storing "AVAILABLE" status wastes space
   - Most slots are empty/available
   
4. **Complex Queries**:
   - Need array queries with 'in' operator (limited to 10 items)
   - Multiple reads for bookings data

5. **Write Amplification**:
   - Generating slots = 70 writes
   - Each status change = 1 write

## New Architecture

### Structure: One Document Per Venue

```typescript
// Collection: venueSlots
// Document ID: venueId

interface VenueSlots {
  venueId: string;
  
  // Configuration to reconstruct all slots
  config: {
    startTime: string;      // "06:00"
    endTime: string;        // "22:00"
    slotDuration: number;   // 60 (minutes)
    daysOfWeek: number[];   // [0,1,2,3,4,5,6] - 0=Sunday
    timezone: string;       // "Asia/Kathmandu"
  };
  
  // Only store exceptions (information entropy)
  blocked: Array<{
    date: string;           // "2025-11-20"
    startTime: string;      // "10:00"
    reason?: string;        // "Maintenance"
    blockedBy?: string;     // managerId
    blockedAt: Timestamp;
  }>;
  
  bookings: Array<{
    date: string;
    startTime: string;
    bookingId: string;      // Reference to bookings collection
    bookingType: "physical" | "website";
    status: "CONFIRMED" | "PENDING_PAYMENT";
    customerName?: string;  // For physical bookings
    customerPhone?: string; // For physical bookings
    userId?: string;        // For website bookings
    createdAt: Timestamp;
  }>;
  
  held: Array<{
    date: string;
    startTime: string;
    userId: string;
    holdExpiresAt: Timestamp;
    createdAt: Timestamp;
  }>;
  
  reserved: Array<{
    date: string;
    startTime: string;
    note?: string;
    reservedBy: string;     // managerId
    reservedAt: Timestamp;
  }>;
  
  updatedAt: Timestamp;
}
```

### Benefits:
- ✅ **1 read** instead of 70 for weekly view
- ✅ **99% reduction** in storage (only exceptions)
- ✅ **Single transaction** for all operations
- ✅ **No query limits** - all data in one doc
- ✅ **Atomic updates** - array operations
- ✅ **Cost effective** - Free tier sustainable

## Files Affected

### Core Components (High Priority):
1. ✅ **`components/WeeklySlotsGrid.tsx`** (898 lines)
   - Main slot display and booking UI
   - Used by both managers and users
   - Needs complete rewrite

2. ✅ **`components/SlotEditor.tsx`** (212 lines)
   - Manager slot generation
   - Add/delete slots
   - Needs rewrite

3. ✅ **`components/BookingForm.tsx`** (186 lines)
   - User booking interface (if still used)
   - Fetch and display slots
   - Might be redundant

### Related Components:
4. ✅ **`components/ManagerPanel.tsx`** (533 lines)
   - Uses WeeklySlotsGrid
   - No direct changes needed (uses abstraction)

5. ✅ **`components/UserPanel.tsx`** (159 lines)
   - Uses WeeklySlotsGrid
   - No direct changes needed (uses abstraction)

### API Routes:
6. ✅ **`app/api/cron/route.ts`**
   - Auto-generates slots (if used)
   - Needs rewrite or removal

### Payment Flow:
7. ✅ **`app/payment/[bookingId]/page.tsx`**
   - Updates slot status after payment
   - Needs to update array instead of doc

## Implementation Strategy

### Phase 1: Create Abstraction Layer (New Module)
Create `lib/slotService.ts` with all slot operations:

```typescript
// lib/slotService.ts

export interface SlotConfig {
  startTime: string;
  endTime: string;
  slotDuration: number;
  daysOfWeek: number[];
  timezone?: string;
}

export interface SlotException {
  date: string;
  startTime: string;
  type: 'blocked' | 'booked' | 'held' | 'reserved';
  data: any;
}

export interface ReconstructedSlot {
  date: string;
  startTime: string;
  endTime: string;
  status: 'AVAILABLE' | 'BLOCKED' | 'BOOKED' | 'HELD' | 'RESERVED';
  bookingType?: 'physical' | 'website';
  bookingId?: string;
  // ... other metadata
}

export interface BookingData {
  bookingId: string;
  bookingType: 'physical' | 'website';
  status: 'CONFIRMED' | 'PENDING_PAYMENT';
  customerName?: string;
  customerPhone?: string;
  userId?: string;
}

// Core functions to implement:
export async function getVenueSlots(venueId: string): Promise<VenueSlots | null>
export async function reconstructSlots(
  config: SlotConfig, 
  exceptions: any, 
  startDate: Date, 
  endDate: Date
): Promise<ReconstructedSlot[]>
export async function initializeVenueSlots(venueId: string, config: SlotConfig): Promise<void>
export async function blockSlot(venueId: string, date: string, startTime: string, reason?: string): Promise<void>
export async function unblockSlot(venueId: string, date: string, startTime: string): Promise<void>
export async function bookSlot(venueId: string, date: string, startTime: string, bookingData: BookingData): Promise<void>
export async function unbookSlot(venueId: string, date: string, startTime: string): Promise<void>
export async function holdSlot(venueId: string, date: string, startTime: string, userId: string, expiresAt: Timestamp): Promise<void>
export async function releaseHold(venueId: string, date: string, startTime: string): Promise<void>
export async function cleanExpiredHolds(venueId: string): Promise<void>
export async function updateSlotConfig(venueId: string, config: Partial<SlotConfig>): Promise<void>
export async function reserveSlot(venueId: string, date: string, startTime: string, note?: string): Promise<void>
export async function unreserveSlot(venueId: string, date: string, startTime: string): Promise<void>
```

### Phase 2: Migration Script
Create `scripts/migrateSlots.ts`:
- Read all existing slots from Firestore
- Group by venueId
- Determine config from existing slots
- Convert to new format
- Write to venueSlots collection
- Verify data integrity
- Backup old data before deletion

```typescript
// Pseudocode for migration
async function migrateSlots() {
  // 1. Get all venues
  const venues = await getAllVenues();
  
  for (const venue of venues) {
    // 2. Get all slots for this venue
    const oldSlots = await getOldSlots(venue.id);
    
    // 3. Detect config from existing slots
    const config = detectConfig(oldSlots);
    
    // 4. Extract exceptions
    const blocked = oldSlots.filter(s => s.status === 'BLOCKED');
    const bookings = oldSlots.filter(s => s.status === 'BOOKED');
    const held = oldSlots.filter(s => s.status === 'HELD');
    const reserved = oldSlots.filter(s => s.status === 'RESERVED');
    
    // 5. Create new document
    await createVenueSlots(venue.id, {
      config,
      blocked: transformBlocked(blocked),
      bookings: transformBookings(bookings),
      held: transformHeld(held),
      reserved: transformReserved(reserved)
    });
    
    // 6. Verify
    await verifyMigration(venue.id, oldSlots);
  }
  
  // 7. After verification, optionally delete old slots
}
```

### Phase 3: Update Components
Update in order:
1. **WeeklySlotsGrid** - Replace all Firestore slot queries with slotService
2. **SlotEditor** - Use slotService for slot generation
3. **Payment flow** - Use slotService to update bookings array
4. **Remove/update BookingForm** if redundant
5. **Update/remove cron job**

### Phase 4: Testing Checklist
- [ ] User can view available slots
- [ ] User can book slot (website booking)
- [ ] User slot shows in held state for 5 minutes
- [ ] Manager can view all slots
- [ ] Manager can block/unblock slots
- [ ] Manager can create physical booking
- [ ] Manager can unbook physical booking (only physical)
- [ ] Manager cannot unbook website booking
- [ ] Hold slots work (5 min expiry)
- [ ] Expired holds are cleaned automatically
- [ ] Payment flow updates slot correctly from HELD to BOOKED
- [ ] Multiple users can't book same slot (race condition)
- [ ] Multiple managers don't conflict
- [ ] Past slots don't show as available
- [ ] Config changes apply to future slots only
- [ ] Different booking types show different colors
- [ ] Physical bookings show store icon
- [ ] Time zone handling works correctly
- [ ] Daylight saving time handled

### Phase 5: Deployment
1. Create git branch: `refactor/slot-architecture`
2. Deploy slotService module (no breaking changes yet)
3. Run migration script on staging database
4. Test thoroughly on staging
5. Deploy updated components to staging
6. Test end-to-end on staging
7. Deploy to production during low-traffic period
8. Run migration on production
9. Monitor for errors/issues
10. Keep old slots collection for 1 week (rollback safety)
11. After verification, archive old slots collection

## Migration Considerations

### Data Safety:
- ✅ Create full backup before migration
- ✅ Test on small subset of venues first (1-2 venues)
- ✅ Keep old data for 1 week minimum
- ✅ Verify counts match (blocked, booked, held counts)
- ✅ Verify no data loss in migration

### Rollback Plan:
- Keep old slots collection intact
- Feature flag to switch between old/new service
- Can revert code changes via git
- Migration script should be reversible
- Document rollback steps

### Edge Cases to Handle:
- ⚠️ Concurrent bookings during migration window
- ⚠️ Held slots with active expiry during migration
- ⚠️ Pending payments during migration
- ⚠️ Time zone handling (UTC vs local time)
- ⚠️ Daylight saving time transitions
- ⚠️ Slots spanning midnight
- ⚠️ Very large arrays (Firestore limit: 1MB per doc)
- ⚠️ Array size growing indefinitely (need cleanup strategy)

### Performance Considerations:
- Old slots in past should be archived/deleted
- Implement cleanup job for old bookings/blocks
- Monitor document size (Firestore limit: 1MB)
- Consider pagination for very long time ranges
- Cache reconstructed slots on client

## Performance Comparison

### Before (Per Venue, Per Week):
- **View weekly slots**: 70 reads
- **Book single slot**: 1 read + 1 write + 1 read (slot doc)
- **Generate weekly slots**: 70 writes
- **Hold slot**: 1 read + 1 write
- **Total for 1000 users viewing**: 70,000 reads
- **Monthly cost estimate**: $$$

### After (Per Venue, Per Week):
- **View weekly slots**: 1 read (venueSlots doc)
- **Book single slot**: 1 read + 1 write (array update)
- **Initialize venue**: 1 write
- **Hold slot**: 1 read + 1 write (array update)
- **Total for 1000 users viewing**: 1,000 reads
- **Monthly cost estimate**: $ (70x reduction)

### Storage Comparison:
- **Before**: 70 docs × 500 bytes = 35KB per venue per week
- **After**: 1 doc × 2KB = 2KB per venue (only exceptions)
- **Reduction**: ~95% storage savings

## Timeline Estimate

- **Phase 1** (Abstraction Layer): 2-3 hours
  - Define TypeScript interfaces
  - Implement core functions
  - Unit tests for reconstruction logic
  
- **Phase 2** (Migration Script): 1-2 hours
  - Write migration logic
  - Test on sample data
  - Verification logic
  
- **Phase 3** (Update Components): 3-4 hours
  - WeeklySlotsGrid refactor
  - SlotEditor refactor
  - Payment flow update
  - Remove old code
  
- **Phase 4** (Testing): 2-3 hours
  - Manual testing all flows
  - Edge case testing
  - Performance testing
  
- **Phase 5** (Deployment): 1 hour
  - Deploy to staging
  - Monitor and verify
  - Deploy to production

**Total Estimated Time: 9-13 hours**

## Risk Assessment

### High Risk Areas:
- ❗ Data loss during migration
- ❗ Concurrent booking conflicts
- ❗ Payment flow breaking
- ❗ Race conditions in array updates

### Medium Risk Areas:
- ⚠️ Hold cleanup not working correctly
- ⚠️ Time zone issues causing booking errors
- ⚠️ UI rendering performance with reconstruction
- ⚠️ Document size exceeding 1MB limit

### Low Risk Areas:
- ✓ Config changes
- ✓ Manager block/unblock operations
- ✓ Read performance (will improve)
- ✓ Cost reduction (guaranteed improvement)

## Mitigation Strategies

1. **For Data Loss**: 
   - Full backup before migration
   - Verify each venue after migration
   - Keep old collection for rollback

2. **For Concurrent Bookings**:
   - Use Firestore transactions
   - Check array for duplicates
   - Implement optimistic locking

3. **For Payment Flow**:
   - Test payment flow thoroughly
   - Keep payment logic idempotent
   - Add error recovery

4. **For Document Size**:
   - Archive old bookings regularly
   - Set retention policy (e.g., 90 days)
   - Monitor document sizes

## Decision Points

### 1. When to migrate?
**Options:**
- A) Now (before more data accumulates) ✅ RECOMMENDED
- B) After major features complete
- C) During scheduled maintenance window

**Recommendation**: Option A - The longer we wait, the more data to migrate and higher risk.

### 2. Migration approach?
**Options:**
- A) All-at-once with rollback plan ✅ RECOMMENDED
- B) Gradual with feature flag per venue
- C) Parallel run both systems

**Recommendation**: Option A - Simpler to manage, cleaner cutover.

### 3. Keep old data how long?
**Options:**
- A) 1 week ✅ RECOMMENDED
- B) 1 month
- C) Forever (archive)

**Recommendation**: Option A with option to extend if issues found.

### 4. Cleanup strategy?
**Options:**
- A) Auto-delete bookings > 90 days old ✅ RECOMMENDED
- B) Manual cleanup by manager
- C) Never delete (keep forever)

**Recommendation**: Option A - Keeps document size manageable.

## Success Criteria

### Must Have:
- ✅ Zero data loss in migration
- ✅ All booking flows work correctly
- ✅ Performance improved (faster page loads)
- ✅ Cost reduced (lower Firestore bill)
- ✅ No user-facing bugs

### Nice to Have:
- ✅ Cleaner codebase
- ✅ Better type safety
- ✅ Easier to maintain
- ✅ Better error handling
- ✅ Monitoring/logging improved

## Post-Migration Tasks

1. **Week 1**: Monitor closely for issues
2. **Week 2**: Verify old slots collection not needed
3. **Week 3**: Archive old slots to backup storage
4. **Week 4**: Delete old slots collection
5. **Ongoing**: Monitor document sizes, implement cleanup

## Open Questions

1. Should we implement real-time updates for concurrent users?
2. How to handle multi-day bookings (tournaments)?
3. Should managers be able to set different slot durations per day?
4. How far in advance should users be able to book?
5. Should we implement slot templates for recurring events?

## Next Steps

1. ✅ Review this plan with team
2. ✅ Get approval for breaking changes
3. ✅ Create git branch: `refactor/slot-architecture`
4. ✅ Commit current state to git
5. ⏳ Implement Phase 1: `lib/slotService.ts`
6. ⏳ Write unit tests for slot reconstruction
7. ⏳ Test abstraction layer thoroughly
8. ⏳ Proceed to Phase 2: Migration script
9. ⏳ Test migration on sample data
10. ⏳ Continue through remaining phases...

---

## Approval Required

**Breaking Changes:** YES - Complete architecture change
**Data Migration:** YES - All slot data will be restructured
**Downtime Required:** NO - Can be done with zero downtime
**Estimated Cost Savings:** 70x reduction in Firestore operations

**Approver Signature:** _________________
**Date:** _________________
