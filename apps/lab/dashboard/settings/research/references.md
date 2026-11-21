# References: Settings area (Goteav operations dashboard)

Research date: 2026-11-18. Screenshots sit in this folder as `ref-<product>-<view>-d.png` (desktop).
Honesty note: Stripe, Shopify admin, Vercel, GitHub, Cloudflare and Notion settings screens need a login, so I
did not see them live. Where I cite them I quote their public docs only, and anything taken from general
knowledge is marked **(unverified)**. Product screenshots below come from each vendor's own help pages or docs
(Salla, VS Code, Linear, Google, LaunchDarkly, Supabase) or from a live public page (Primer). No mobile (390 px)
captures: none of the real settings UIs is public, and mobile captures of docs pages would show nothing useful.
docs.stripe.com timed out, and the Shopify settings template preview iframe rendered blank, so neither has a
screenshot.

## Job to be done
The owner or a senior staff member needs to find any platform rule fast, by group or by single field. They need
to see at a glance what is on or off, risky, or recently changed, and change it safely: review the exact diff,
confirm high-impact changes, and know who changed what and how to roll back. Their own browser preferences
(appearance, tables, notifications) must stay clearly separate and apply instantly.

Context checked in code: `backend/src/modules/settings/groups/` holds 33 `*.settings.ts` files (the brief counts 30
exposed groups). Several descriptions already point at each other. For example, `flights` says "hold, cancellation
and change settings live in `flight_provider`", and `pricing` only says where `markup_rules` comes from. The UI
should show these links rather than hide them (see patterns 2 and 7).

## Reference table

| # | Product / URL / screenshot | Pattern | Why it works | How it applies to Goteav |
|---|---|---|---|---|
| 1 | **Salla: unified settings center (Arabic-first, RTL)**. https://help.salla.sa/en/article/unified-settings-center/kcn2a9npykcvleosgdz201u0. `ref-salla-settings-profile-d.png`, `ref-salla-settings-plan-d.png`, `ref-salla-settings-orders-d.png` | One settings panel opens over the dashboard and can expand to full page. The right-hand (RTL) sidebar has a search field at the top ("ابحث في الإعدادات") and 20+ pages, split into clusters by thin dividers: you and the plan, then money, then catalogue and operations. Each page has a soft tinted icon tile. Content is bordered row cards: title, one-line description, and the control at the inline end (switch, select, chevron to drill in, or external-link icon). Personal profile (language, dark mode) is the first item in the same panel. Each store section can open the panel on its own page (orders → "Order settings"). A destructive item ("إيقاف الاشتراك مؤقتًا", pause subscription) gets red text in its own card at the bottom. | Native RTL proof: the sidebar sits on the right, chevrons point left, the control sits at the left end of each row, and Arabic labels stay short. Contextual entry means you never hunt from the top. Dividers group 20+ items without a second navigation level. | **High.** Copy the row anatomy and the RTL mirroring. Add "open settings for this module" links from Flights, Payments and Customers pages that land on the matching group. Use divider clusters rather than tabs for the 7 sections. Do not copy the coloured icon tiles one-to-one for 30 groups (too much colour); keep neutral surfaces with a coloured icon only (owner rule). From the screenshots, the toggles seem to apply instantly, since no Save button is visible **(unverified)**. Goteav server groups need an explicit Save instead. |
| 2 | **VS Code: Settings editor**. https://code.visualstudio.com/docs/configure/settings. `ref-vscode-search-d.png`, `ref-vscode-modified-bar-d.png`, `ref-vscode-gear-reset-d.png`, `ref-vscode-filters-d.png`, `ref-vscode-user-workspace-tabs-d.png` | Search filters every field across all groups. The table of contents shows match counts per group ("Text Editor (3)"), and the header shows "5 Settings Found". Each result keeps its path as a prefix ("Debug › Console: **Word Wrap**"). Modified fields get a marker at the start edge. A per-field gear menu offers Reset to default, Copy setting ID, Copy JSON and Copy settings URL (deep link `vscode://settings/<id>`). Filters are typed tokens: `@modified`, `@tag:`, `@id:`. **User / Workspace** tabs share one tree. "(Modified elsewhere)" warns when another scope overrides a field. A "Commonly Used" group sits at the top. Descriptions link to related settings ("when Editor: Word Wrap is wordWrapColumn"). | Best public example of field-level search across hundreds of settings. The path prefix answers "where does this live?" without opening the group. `@modified` answers "what did we change from default?" in one query. | **Very high** for search and field rows. Search should return fields (path "Access › Security › Lockout: **Max failures**") with counts per section. Add `changed:` / `risky:` / `recent:` filter chips. Add per-field Reset and Copy link (`/settings/access/security#lockout.maxFailures` with highlight on arrival). Cross-links in help text ("Hold and cancellation rules live in Flight provider"). **Conflict:** VS Code marks modified fields with a coloured bar at the start edge. That breaks the owner's no-stripes rule, so use a small dot or a "changed" pill next to the label. VS Code applies changes instantly, which fits Goteav's personal preferences only. |
| 3 | **Linear: settings redesign (Dec 2024)**. https://linear.app/changelog/2024-12-18-personalized-sidebar. `ref-linear-team-settings-summary-d.png` | Settings replace the app sidebar ("Back to app" at the top). The sidebar has four labelled sections: **Account** (Profile, Preferences, Notifications, Security & access), **Features**, **Administration** (admins only) and **Your teams**. A team's settings page is a summary list: each row has icon, title, one-line description, the **current value at the row end** ("3 members", "4 labels", "Off", "5 statuses") and a chevron to the full configuration. Rows are grouped under sub-headings ("Workflow"). | "You" and "workspace" are separate named sections in one shell. Admin-only sections simply do not appear for others. The summary row turns a directory into a status board. | **Very high.** Overview and section pages should list groups as rows that show live state ("Lockout: 5 tries / 15 min", "IP allow-list: Off", "Refunds: customer's choice"). Sidebar: "My preferences" (3) on top, then "Organisation" (7 sections), with gateway keys and WhatsApp hidden for anyone without permission. |
| 4 | **Google Workspace Admin: Security health**. https://support.google.com/a/answer/7491656 (now https://knowledge.workspace.google.com/admin/security/get-started-with-the-security-health-page). `ref-google-workspace-security-health-d.png` | One table of 42 settings drawn from many apps. Each row shows the setting name, the **breadcrumb path to where it lives** ("Apps > Google Workspace > Settings for Drive and Docs"), a **status sentence** ("Enabled for 1 org unit", "Disabled for the entire organization"), and either a green check (secure) or a recommendation icon. Clicking a status opens the exact settings place. A filter sits at the top, and the header shows "Showing 42 settings". | A view across groups that answers "are we safe?" without opening any of them. Status as a sentence is clearer than a bare switch. | **Very high.** Build an "Attention" or "Health" view across the 33 groups: admin IP allow-list off, lockout disabled, magic-link lifetime long, maintenance scheduled, e-invoicing on without a tax office, and so on. Each row links straight to the field. The checks would need a rule list (to be written in `audit.md`). |
| 5 | **Supabase: Security & Performance Advisor**. https://supabase.com/features/security-and-performance-advisor, https://supabase.com/blog/security-performance-advisor. `ref-supabase-advisor-d.png` | Lint results sit in **severity tabs with counts**: Errors 0, Warnings 1, Info 4 suggestions. A table lists issue type, entity and description. A side panel shows Issue, Description and a link to the docs. Below sit "Rerun linter" and "How are these suggestions generated?". Rules can be switched off (feature preview per Supabase's post). | Severity tiers keep a warning from shouting like an error. The side panel explains without leaving the list. | **High.** Use three tiers for setting checks: *blocking* (would break; the zod `superRefine` rules already reject these on Save), *risky* (allowed but unsafe) and *suggestion*. Show counts on the overview header and on each section. Let the owner dismiss a suggestion with a reason. |
| 6 | **LaunchDarkly: change history and version restore**. https://launchdarkly.com/docs/home/releases/change-history, https://launchdarkly.com/docs/home/releases/version-restore. `ref-launchdarkly-change-history-d.png`, `ref-launchdarkly-change-entry-diff-d.png` | A clock icon on any page opens the change history **already filtered to that page's context** (resource, project, environment). Each entry is a sentence ("X updated the flag Y in Production"), then a plain-language list of changes, then the raw JSON, with a copyable link per entry. Restore works **forward only**: "if you are on version 5 and restore version 3, version 3 ... becomes version 6". The flow is diff → "Stage this version" → "Review and save" → type the environment name to confirm. Reviewers and approvals are possible for some change types. | Audit you can read without parsing JSON. Rollback never rewrites history, which matches Goteav's versioned groups. | **Very high.** Group page: a "History" drawer with entries "Ahmed changed 3 fields · v14 · 2 h ago", a plain diff (old → new with units) and an optional JSON view. "Restore v12" creates v15 after showing the diff. Use type-to-confirm only for top-impact groups (security, payment methods, maintenance). |
| 7 | **Primer (GitHub): Saving pattern**. https://primer.style/product/ui-patterns/saving/. `ref-primer-saving-d.png` | Start with explicit saving. **Never mix explicit and automatic saving in one form**, and avoid mixing on one page. Keep the Save button **enabled** even when the form is unchanged or invalid (disabled buttons can't be tabbed to and are low contrast). **One save button per page**, not one per section. On error, keep the user's input. Warn on leaving with unsaved changes. Labels are a verb plus the object when unclear ("Save security preferences"). | Accessibility-grounded rules from a team that runs one of the largest settings areas. | **High.** Personal preferences stay instant on their own pages. Each server group is one form with one Save for the whole group, never per sub-section. Save label: "Save Security (v15)". If nothing changed, show "Nothing to save" rather than disabling the button. Block route changes while the form is dirty. |
| 8 | **Shopify App Home: settings template and Save Bar**. https://shopify.dev/docs/api/app-home/patterns/templates/settings, https://polaris.shopify.com/components/contextual-save-bar (no screenshot: preview did not render) | "Make each group a section. Name the group with heading, and explain what it controls with subheading rather than a paragraph." A list of items with their own status goes in nested sections, with the status in the header. `data-save-bar` shows **Save / Discard** only when the form is dirty. Polaris rules: verb-only labels ("Save", "Discard"); don't let several forms be edited at once. A two-column variant puts contextual help in an aside. | The dirty-state bar is the clearest "you have unsaved changes" signal, and it sits in a fixed place. | **High.** Sub-sections inside a group (Lockout, Login alerts, IP allow-list, Invites, Login history, Phone login, Magic link) each get a heading plus a one-line subheading. Use a sticky bar at the bottom of the group page: "3 changes · Review · Discard · Save". Conflict with Primer: Primer keeps Save always enabled, Shopify shows the bar only when dirty. Suggested blend: the bar is always present, its text changes from "Up to date · v14 · by Sara, 2 days ago" to "3 unsaved changes". |
| 9 | **GitHub: repository settings "Danger Zone"**. https://docs.github.com/en/repositories/creating-and-managing-repositories/deleting-a-repository (login-gated UI, docs only) | Irreversible actions sit together at the end of settings in a "Danger Zone" section. Deleting asks you to read the warnings, acknowledge their effects, and **type the repository name**. | Friction matches the size of the risk, and destructive things are never next to everyday fields. | **Medium.** Goteav has few destructive settings but several high-impact ones: maintenance on, a gateway off, lockout off, IP allow-list on. Rather than a "zone", tag individual fields as high-impact and ask for a typed confirm only when such a field is in the diff. GitHub's danger zone uses a red bordered card **(unverified visual)**. Do not copy that: owner rule, red icon and text only. |
| 10 | **Vercel: Team vs Project settings**. https://vercel.com/docs/project-configuration/project-settings | Two scopes, each with its own Settings area: "Team Settings ... applied at the team-level" and "Project Settings ... specific settings for the selected project". Sections are named by domain nouns: General, Build and Deployment, Domains, Environment Variables, Git, Integrations, Deployment Protection, Functions, Security, Advanced. Each section card has its own footer help text and Save **(unverified, general knowledge)**. | Clear scope naming. Plain-noun sections avoid clever names. | **Medium.** It confirms that "you" and "organisation" need separate names. The per-card Save is the opposite of Primer's one-save rule; Goteav groups already map one group to one form, so keep one Save per group page. |
| 11 | **Apple macOS: System Settings search**. https://support.apple.com/guide/mac-help/mchl8d10839d/mac. Criticism: https://www.podfeet.com/blog/2025/11/mind-mapping-mos-settings/ (no screenshot) | Matching settings are listed under the search field. Suggestions are "based on settings you access most often", and **Recents** shows the last visited settings. Users report search misses (a blogger built a mind map of macOS settings as a workaround). | Recents and frequent items cut navigation for repeat tasks. The criticism shows that synonyms make or break settings search. | **Medium.** Add "Recently changed" and "Pinned" lists to the overview. Index Arabic and English synonyms per field (for example, قفل / lockout / حظر; هامش / markup / margin), not only labels. |
| 12 | **ui-ux-pro-max** (local skill; `--design-system` with `--density 8`, plus `--domain ux`) | The design-system answer (glassmorphism, Fira Code/Fira Sans, dark slate + green) **does not fit**: it ignores the live Goteav tokens and Cairo, so it is not adopted. The useful parts: dense spacing scale (8–32 px), status colours green/amber/red. From the UX domain: deep links ("update URL on state/view changes"), autocomplete for search, a no-results state that suggests alternatives, confirmation for destructive actions, loading → success/error feedback on submit, visible labels (no placeholder-only inputs). | Baseline checklist. | Use as acceptance criteria, not as visual direction. |

## How the references answer the six questions

1. **Information architecture for 30+ groups.** Linear, Salla and VS Code all use **one shell with a grouped
   sidebar** and no second-level tabs. Linear and Salla split long lists with section labels or dividers; VS Code
   uses a collapsible tree. None of them needs a separate hub page, but Linear's team page shows a **summary hub
   is worth having when rows carry live state**. For Goteav: a sidebar with 7 section labels (Access & security,
   Customers, Payments, Pricing & tax, Staff policies, Flights, System), the groups under each, and an overview
   that shows state rather than names. Overlaps (security / security_alerts / abuse_protection; flights /
   flight_provider / flight_guards; payment_methods / gateway keys) should get **one-line "what lives where"
   notes** at the top of the section, plus cross-links in field help, as VS Code does.
2. **Search to field level.** VS Code is the model: field results with a path prefix, counts per group, filter
   tokens, and a copyable deep link per field. Google Health adds the breadcrumb path in result rows. Apple adds
   Recents and frequent items. Search must also cover Arabic and English synonyms and highlight the field on
   arrival (scroll plus a brief background pulse, not a coloured bar).
3. **Group page anatomy.** Shopify and Salla: sub-sections with a heading and a one-line subheading, and rows of
   label, help, then the control at the inline end. VS Code: per-field Reset and Copy link, plus a "changed from
   default" marker. Primer and Shopify: one form, one sticky Save/Discard bar, block navigation while dirty.
   LaunchDarkly: review diff, typed confirm for high-impact changes, history drawer, restore as a new version.
4. **Status at a glance.** Linear (value at the row end), Google Health (status sentence plus check or
   recommendation), Supabase (severity tabs with counts).
5. **"You" vs "organisation".** Linear (Account vs Administration), VS Code (User vs Workspace tabs), Vercel
   (Team vs Project), Salla (Profile first in the same panel). They agree on one door, two clearly labelled scopes,
   and different save behaviour per scope.
6. Creative ideas and anti-patterns are below.

## Recurring patterns (ranked by evidence and fit)

1. **Overview rows show live state, not only names** (Linear row-end values, Google status sentences, Salla
   inline switches). This fixes the brief's main complaint ("reads as a directory, not a control centre").
2. **Field-level search with a path prefix, counts per section, filter chips and deep links** (VS Code, Google
   Health, Apple Recents). Highlight the target field on arrival and keep the URL in sync.
3. **One shell, two scopes, labelled plainly**: "My preferences" (instant, this browser) above "Organisation"
   (server, versioned). Permission-gated items are hidden rather than greyed (Linear, VS Code, Vercel, Salla).
4. **One explicit form per group with a sticky dirty-state bar** (Save / Discard / Review) and an unsaved-changes
   guard. Never mix instant and explicit saving in one form (Primer, Shopify, Polaris).
5. **Review the diff before saving, in plain language first and JSON second**: old → new with units and the
   section path, then "Save as v15" (LaunchDarkly change entries and restore flow).
6. **History drawer in context, with forward-only restore and a link per entry**: "who, what, when, version".
   Restoring v12 creates a new version after showing the diff (LaunchDarkly).
7. **Sub-sections inside a group** with a heading and one-line subheading, label + help + control rows, units
   shown as suffixes (min, h, days, SAR), min/max shown in the help line, and cross-links to related groups
   (Shopify, Salla, VS Code).
8. **Attention view across groups with severity tiers** (blocking / risky / suggestion) and each issue linking to
   its field (Google Health, Supabase Advisor).
9. **Per-field "changed from default" marker plus Reset to default plus Copy link** (VS Code gear menu and
   `@modified`). Use a dot or pill, never a side bar.
10. **Friction in proportion to risk**: typed confirmation only when a high-impact field is in the diff; normal
    Save for everything else (GitHub, LaunchDarkly).

## Bold ideas worth testing (not the industry default)

1. **Rules written as sentences you can edit ("rule sentences").** Each group card, and the top of each group
   page, shows the current configuration as one readable Arabic or English sentence whose numbers are the
   inputs: "بعد **5** محاولات فاشلة خلال **15** دقيقة يُقفل الحساب **1 → 5 → 15 → 60** دقيقة". Click a number
   to edit it inline; the full form stays one click away. *Why for Goteav:* the owner thinks in business rules,
   not schema keys, and Arabic sentences read naturally in RTL. It builds on Google's status sentences and
   LaunchDarkly's plain-language change lists, but makes them editable. It needs a sentence template per
   sub-section (could be part of `audit.md`).
2. **"As of" time travel.** A date picker on the overview and on each group shows the values in force on that
   date, using the existing version history: "What was the refund policy when booking GTV-… was made on 3
   October?" *Why for Goteav:* disputes, refunds and accountant questions always concern the rule in force at
   booking time, and versioned groups already hold the data. No reference shows this as a first-class view;
   LaunchDarkly only goes as far as restoring a version.
3. **Impact preview in the Save review.** Before saving, the review sheet says what changes for whom, using
   per-field impact metadata: "Max failures 5 → 3: applies to all staff and customer sign-ins from the next
   attempt"; "Default markup 4% → 4.5%: a 1,000 SAR fare now shows 1,045 SAR"; "Maintenance: customers see the
   banner from 02:00". *Why for Goteav:* many fields are money thresholds or durations whose effect is not
   obvious from the number. It turns the diff into a decision aid and gives a natural trigger for the typed
   confirm (high-impact lines).
4. **Change sets across groups ("change ticket").** Edits in several groups (for example, payment_methods plus
   refund_policy) can be staged as one draft, reviewed in one diff and applied together. Each group still gets
   its own version bump, and the ticket links them in history. *Why for Goteav:* real policy changes often span
   groups that the backend splits. Mark as **proposed**: the backend saves per group, so applying would be
   sequential with a partial-failure state to design.

## Anti-patterns to avoid

1. **A directory overview**: group names and descriptions with no state (today's page). Shopify's guidance even
   says "don't include a description unless it's helpful"; state beats prose.
2. **Mixing instant and explicit saving in one form**, or Save buttons per sub-section (Primer: "never mix save
   patterns in a single form", "don't have one save button per section"). Personal preferences being instant is
   fine only because they live on their own pages.
3. **A diff shown only as raw JSON, or no diff at all.** LaunchDarkly leads with a sentence and a readable list
   and keeps JSON as a secondary view. Also avoid confirm dialogs on every Save: keep friction for high-impact
   fields only (general UX guidance, not measured here).
4. **Coloured side or top stripes** for "modified", "danger" or "selected" states (VS Code's modified bar, a
   red-bordered danger card, Salla's selected-item edge bar). These break the owner's no-stripes rule. Use a dot,
   a pill, a tinted icon or text colour instead.
5. **Search limited to group names, or without synonyms** (today's page; Apple users report missed settings).
   Field-level, bilingual and synonym-aware search is the baseline.
6. Unexplained overlap: groups whose names collide (security / security_alerts / abuse_protection; flights /
   flight_provider / flight_guards) shown side by side with no "what lives where" note or cross-links.

## Sources
- Salla unified settings center: https://help.salla.sa/en/article/unified-settings-center/kcn2a9npykcvleosgdz201u0 (images from cdn.salla.sa inside the article)
- VS Code settings: https://code.visualstudio.com/docs/configure/settings (images from code.visualstudio.com/assets/docs/configure/settings/)
- Linear changelog, settings redesign: https://linear.app/changelog/2024-12-18-personalized-sidebar ; https://linear.app/docs/workspaces
- Google Workspace security health: https://support.google.com/a/answer/7491656 ; https://knowledge.workspace.google.com/admin/security/monitor-the-health-of-your-security-settings
- Supabase advisors: https://supabase.com/features/security-and-performance-advisor ; https://supabase.com/blog/security-performance-advisor
- LaunchDarkly: https://launchdarkly.com/docs/home/releases/change-history ; https://launchdarkly.com/docs/home/releases/version-restore ; https://launchdarkly.com/docs/home/releases/approval-requests
- Primer saving: https://primer.style/product/ui-patterns/saving/
- Shopify: https://shopify.dev/docs/api/app-home/patterns/templates/settings ; https://polaris.shopify.com/components/contextual-save-bar ; https://polaris.shopify.com/patterns/app-settings-layout
- GitHub: https://docs.github.com/en/repositories/creating-and-managing-repositories/deleting-a-repository
- Vercel: https://vercel.com/docs/project-configuration/project-settings
- Apple: https://support.apple.com/guide/mac-help/mchl8d10839d/mac ; https://www.podfeet.com/blog/2025/11/mind-mapping-mos-settings/
- Not captured: Stripe (docs.stripe.com timed out; dashboard needs login), Cloudflare, Notion, Clerk, Intercom, Atlassian, Carbon, Material (no time in this session; nothing claimed about them).
- Screenshots viewed directly: salla (3), vscode-search, vscode-modified-bar, linear, google-workspace, launchdarkly (2), supabase, primer. Saved from the VS Code docs but not opened: vscode-filters, vscode-gear-reset, vscode-user-workspace-tabs (the claims about them come from the VS Code docs text).
