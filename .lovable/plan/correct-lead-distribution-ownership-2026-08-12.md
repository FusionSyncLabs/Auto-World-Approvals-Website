# Correct lead distribution ownership

## Goal
Guarantee that each lead is assigned and emailed to exactly one paying client, while admin and unassigned recipients remain informational copies and can never be recorded as first contact.

## Changes
- Make the database assignment atomic per lead across all distribution lists, preserving one durable paying-client owner even when autosave, submission, and recovery jobs overlap.
- Remove broadcast behavior from automatic distribution: a list with multiple active clients alternates one at a time; a list with one active client always selects that client.
- Fail closed if assignment cannot be confirmed instead of falling back to an arbitrary list member.
- Restrict first-contact/status updates to the confirmed assigned paying client only; admin and unassigned informational recipients never qualify.
- Validate recent delivery records and the live rotation state after the fix.

## Technical details
- Update `assign_rotation_contact` and assignment uniqueness to enforce one assignment per lead.
- Update the server delivery recipient construction and first-contact logic to use only the confirmed assignment.
- Preserve informational email copies and existing per-recipient send idempotency.
