# Contractor Area Calculator

## Goal
Add a slab/roof area calculator immediately above the contract amount fields without changing the existing contractor workflow.

## Changes
- Add temporary Length, Width, and Rate inputs to the contractor dialog.
- Calculate total square feet as `length × width` and estimated amount as `area × rate` while values change.
- Show both calculated results in a compact summary matching the current form styling.
- Add “राशि फ़ॉर्म में भरें” to copy the estimated amount into “कुल अनुबंध राशि”.
- Reset calculator values whenever a new or existing contractor form is opened; do not store calculator measurements in the contract record.
- Keep existing contract amount, advance, validation, saving, and editing behavior unchanged.

## Validation
- Accept only non-negative decimal measurements and rates.
- Disable the apply button until the calculated amount is greater than zero.
- Verify the dialog builds and the calculation/apply flow works in the preview.

## Technical details
- Implement only in the existing contractor page/dialog.
- Use derived numeric values rather than duplicating calculated totals in state.
- Use the existing Input, Button, and semantic design styles.
