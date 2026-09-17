# Auto-backup retry loop fix

## Changes
- Record the auto-backup attempt time in both backup timestamp keys even when Google Drive upload fails.
- Detect a disconnected Google Drive separately and show a gentle warning instead of a destructive error.
- Save the generated backup locally as a fallback when Drive is disconnected or its upload fails.
- Keep successful Drive backups and offline queued backups unchanged.

## Verification
- Check TypeScript and production build output.
- Confirm the backup hook has no path that immediately remains overdue after an attempted scheduled backup.
