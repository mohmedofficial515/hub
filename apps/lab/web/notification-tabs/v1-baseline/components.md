# v1-baseline — components

Screenshot `1440-rtl-light.png` is the owner's capture (2026-11-22) of the live tabs.

| Piece | File (web, `feat/gtv-472-redesign-ports`) |
|---|---|
| Page, views, `ViewTabs` (segmented, layoutId pill + gold underline) | `src/features/account/notifications/notifications-page.tsx` |
| Entry row, icon tile, unread dot, time | `src/features/account/notifications/inbox-entry.tsx` |
| Kind → icon / tone / link | `src/features/account/notifications/notification-links.ts` |
| Data hooks (`useInbox`, `useInboxTrips`, `useInboxUnreadCount`, `useMarkAllInboxRead`) | `src/apiEndpoint/notifications/*` |
| Strings | `messages/<locale>/domains/account.json` → `notifications` |
