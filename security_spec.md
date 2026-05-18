# Security Specification: School Treasurer Reporting

## 1. Data Invariants
- A report must belong to a valid unit.
- A report must have a status of 'pending' when created by a unit.
- Only the treasurer can change the status of a report.
- Users can only read/edit their own reports (unless they are the treasurer).
- Treasurer notes can only be added/edited by the treasurer.
- Amount received and execution date are immutable after the report is approved (to prevent tampering).

## 2. The "Dirty Dozen" Payloads (Deny List)
1. **The Spoof**: Create a report and set `submittedBy` to another user's ID.
2. **The Status Jump**: Create a report with `status: "approved"`.
3. **The Shadow Field**: Adding `isTreasurer: true` to a report document.
4. **The Ghost Edit**: Editing a report that belongs to another unit.
5. **The Approved Tamper**: Changing `amountReceived` on a report that has already been `approved`.
6. **The Admin Self-Promotion**: Adding oneself to the `admins` collection.
7. **The Jumbo ID**: Using a 2KB string as a report ID to cause resource exhaustion.
8. **The PII Scrape**: Listing all units if not signed in.
9. **The Negative Money**: Setting `amountReceived` or `totalSpent` to a negative number.
10. **The Anonymous Write**: Writing to any collection without authentication.
11. **The Future Date**: Setting `submittedAt` to a future timestamp (relative to server time).
12. **The Empty Report**: Submitting a report with `totalSpent` but no `details` array.

## 3. Implementation Plan
- `isValidReport()` will enforce strict keys and types.
- `isAdmin()` will check the `admins` collection.
- `isOwner()` will check `resource.data.submittedBy`.
- `allow update` will be split into `submitEdit`, `reviewReport`.
