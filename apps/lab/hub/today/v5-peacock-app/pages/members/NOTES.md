# Members: notes for the version README

## Layout idea
A roster with its waiting room on top. "Waiting to join" comes first because it is what the sidebar's count points at and the only part
of the page with a clock on it. Below is the team as a table from 768 px and as stacked rows on a phone, with role chips and search.
Owner and PM see emails, the row menu, invites and disabled accounts. Everyone else sees names, roles, GitHub logins and last seen, with a
menu only on their own row, which holds their profile.

## Deviations from 09 and reasons
1. **Invites sit above the roster.** The wireframe has them below. On a phone they would be seven rows down from the count that sent you.
2. **No `[Copy link]` on a pending invite.** 04 §3.5 says the link is shown once and only its hash is stored, so it cannot be copied later.
   "Resend" makes a new link and shows that once. The wireframe's button cannot exist with this data model.
3. **"Disable" is owner only; the rest of the menu is owner or PM** (04 §3.23).
4. **Revoke is a neutral outline button in the row.** Its confirm dialog carries the destructive styling, so a list of invites does not
   turn into a column of red.
5. **Enter on an invite row moves to its buttons** and does not start a revoke. Enter on a member row opens the roles dialog, or the
   profile on your own row.
6. **The profile is a dialog, not a sheet**, because the card sheet is mounted for cards. `?profile=me` opens it for the shell's menu item.
7. **Search and the role filter are additions.** At 7 people they are small, and they keep the page right as the team grows.
8. **No "best on a larger screen" banner** (08 §7). The page was built for 390 px.

## Shell change needed
`shell/sidebar.tsx`, `MemberMenu`: "Profile" calls `navigate('settings')`, which lands an owner on Sources. It should be
`navigate('members', { query: { profile: 'me' } })`. The page already handles that URL.

## Questions for the owner
1. **Emails for everyone?** 09 §17 says everyone views names and roles, while 04 §3.5 returns email to any session. The page hides it from non-managers.
2. **Two-step warning:** the page warns when a role in `security.totp_required_roles` has it off. The mock's only holder of those roles, the owner, has it on,
   so this state does not appear by default. The real behaviour for those members is a sign-in rule, not defined in 09.

## Checked (2026-11-04, private headless Chromium)
- 390, 768, 1440 × ar, en × light, dark: no horizontal overflow, 0 AA failures (lowest 5.23:1 across Members and Settings).
- Scenarios `frontend`, `empty`, `loading`, `error` at 4 modes.
- Flows: revoke and invite moving the sidebar count, duplicate invite refused, link shown once and gone afterwards, last owner refused with the code, mapping a login, disabling a member, `?profile=me`, Sara seeing no email, invites or Invite button and a menu only on her row.
- Phone: no control under 44 px, every Tab stop has a visible ring.
- Not run: a screen reader; the PM persona, which the lab has no scenario for.

## Review answered (2026-11-04)
- **M7:** Invite is outline. On a page with nobody else it is filled, in the empty state, and hidden from the header.
- **M6:** `FilterBar` with a visible group name. Role and search fold behind Filters on a phone.
- **M14:** "Invited by {name}" and the revoke and disable dialogs no longer pick a gender. Audit summaries written here are verbal nouns.
- **Copy:** «نشطون». Online is «على الخط الآن», which also avoids the masculine «متصل».
