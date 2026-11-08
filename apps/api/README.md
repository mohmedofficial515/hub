# @hub/api

NestJS 11: REST, MCP and workers in one image. Plan: `docs/01`, `docs/03`, `docs/04`. Scope: `docs/15`, which
wins over the others.

## Run it

```bash
pnpm install
pnpm setup:env                                    # root .env with a random key and owner password
docker compose -f infra/compose.dev.yaml up -d    # Postgres 7340, Redis 7341, Mailpit 7342/7343
pnpm db:deploy                                    # or `pnpm db:migrate` when changing the schema
pnpm --filter @hub/api dev                        # http://localhost:7310/api/v1/health/ready, /api/docs
```

| Command                 | What                                                                              |
| ----------------------- | --------------------------------------------------------------------------------- |
| `pnpm check` (root)     | lint, typecheck, arch, unit, OpenAPI snapshot                                     |
| `pnpm test:e2e`         | real Postgres and Redis through Testcontainers                                    |
| `pnpm api:sync`         | re-export OpenAPI into `apps/web/openapi` after an API change                     |
| `pnpm migrations:check` | lint of migration SQL (in `apps/api`)                                             |
| `pnpm import:goteav`    | Goteav's history into project `goteav`; `--dry-run` writes nothing (`docs/06` §7) |

`@hub/contracts` is built to `dist` on install. Tests and typecheck read its source; a running API reads `dist`,
so `pnpm dev` at the root also runs its watcher. If you start only the API, run `pnpm --filter @hub/contracts build`
after changing contracts.

## The one rule

**Every card mutation goes through `CardService.apply`.** Web, MCP and adapters call the same thing, so they cannot
behave differently (`docs/15` §6).

```ts
apply(actor: Actor, target: CardTarget | null, action: PermissionAction, payload: unknown): Promise<ApplyResult>
// target: { cardKey: 'GTV-12' } | { cardId } | null when the action creates a card
```

In one transaction it validates the payload, runs the secret filter over every string, refuses a closed project or a
deleted card, locks the card, checks the permission table, checks the status machine, runs your action's `plan`, writes
the card and its detail, writes **exactly one** event and one audit row, adds watchers and writes the outbox. After
commit it publishes to Redis. The actor's kind is recorded and never used to refuse (D27).

It refuses to run inside an outer transaction, because it publishes after commit. For several things at once, return
`followUps` from the plan.

## Actor

Types are in `@hub/contracts` (`actor.ts`). Credentials give a `Principal`, which belongs to no project.
`ActorService` (`@/modules/identity`) picks the project and reads live roles, giving an `Actor`.

| You are writing                 | Use                                                                        |
| ------------------------------- | -------------------------------------------------------------------------- |
| A route under `/workspaces/:ws` | `@Actor() actor: MemberActor`. `ActorGuard` has already resolved it.       |
| A route with no project (`/me`) | `@CurrentPrincipal() principal: Principal`                                 |
| An MCP tool                     | `actors.forProject(principal, { argument: input.project, header })`        |
| An adapter or job               | `{ kind: 'system', userId: null, via: 'adapter', workspaceId, roles: [] }` |

`PRINCIPAL_RESOLVER` is `CredentialsResolver`: a bearer token, else the session cookie. `ActorService` also applies the TOTP
rule, so REST and MCP are the same. Mark a route `@SessionOnly()` (`@/modules/identity`) when a token must not reach it; an
arch test requires it for every `web_only` action.

E2e tests send `x-test-user` by default, with TOTP off (`test/setup/create-test-app.ts`). `createTestApp({ realAuth: true })`
uses real credentials: `test/helpers/auth.ts` has `anAccount`, `aToken`, `totpCode` and a cookie-keeping `Browser`. Mail goes
to `mailer.sent`.

First owner: `pnpm setup:env`, set `HUB_OWNER_EMAIL` in `.env`, `pnpm db:deploy`, `pnpm seed:owner`. It is safe to run again.

Other modules read settings with `SettingsService.value(workspaceId, key)` and a source's secret with
`SourcesService.readSecret(workspaceId, id)` (`@/modules/workspaces`). Limit a route with `@RateLimit('search')`
(`infra/throttler/rate-limit.guard.ts`).

## Add an action to a card type

1. The verb must be a transition in `packages/contracts/src/cards/<type>.ts`, if it moves the status, and a row in
   `packages/contracts/src/permissions.ts`, named `<type>.<verb>`. Generic actions are `card.<verb>`.
2. Write the action as a provider, one per file. It says what should change and writes nothing itself:

   ```ts
   @Injectable()
   @CardActionHandler()
   export class TaskClaimAction implements CardActionDefinition<ClaimInput> {
     readonly action = 'task.claim';
     readonly payload = claimSchema;
     readonly forbiddenCode = 'hub.tasks.specialty_role_mismatch'; // optional

     plan({ actor, card, payload, now }: CardActionContext<ClaimInput>): CardActionPlan {
       if (card?.assigneeId && card.assigneeId !== actor.userId) {
         throw new AppException('hub.tasks.already_claimed'); // rules the table cannot express
       }
       return {
         patch: { assigneeId: actor.userId }, // card header
         detail: { claimedById: actor.userId, claimedAt: now }, // the type's detail table
         event: { kind: 'claimed', data: { userId: actor.userId } }, // `from` and `to` are added for you
         watchers: actor.userId ? [{ userId: actor.userId, reason: 'assignee' }] : [],
       };
     }
   }
   ```

3. Add it to the `providers` of the module (`modules/tasks/tasks.module.ts`). The registry finds it through the decorator.
4. Test it through `service.apply(...)` in `test/e2e/<module>.e2e-spec.ts`. `test/e2e/cards.e2e-spec.ts` is the model.

The plan's other fields: `create` (when target is null), `notify`, `summary`, `write` (extra rows in the same
transaction, through `CardRepository`; what it returns joins the event's data), `followUps` (more actions in the
same transaction, each with its own event), `prepare` (actions to run before `write` and the event, whose results `write`
receives, for "create tasks from steps" recording the new keys) and `noop` (nothing changed: no event at all). See
`modules/cards/domain/card-action.ts`. `permissions(payload, card)` replaces the default row for an action whose rows depend
on its input or the card, such as an update touching routing fields. A follow-up with `trusted: true` skips the matrix,
because the outer action was permitted; the actor is still recorded. A row of `surface: system` is reachable no other way.

`plan` runs before the status machine, so a rule that wants its own code for a wrong state (`hub.decisions.already_decided`)
throws there. A card reaching a terminal status, or deleted, unblocks its dependants: `apply` does that, not your action.

A status move with no rule of its own is one line: extend `PlainTransition`, `OptionalReasonTransition` or `ReasonTransition`
from `@/modules/cards`.

`modules/tasks/application/task-create.action.ts` is the working example; `modules/plans` shows `prepare` and `followUps`.

## Add a card type

The ten types already have machines (`CARD_MACHINES`), detail tables and repository wiring. Add the module:

1. `src/modules/<type>/<type>.module.ts`, importing `CardsModule` from `@/modules/cards`, and `index.ts`.
2. Add it to `imports` in `src/app.module.ts`.
3. Add actions as above, and the create schema to the union in `modules/cards/presentation/http/card.dto.ts`.

A brand-new type would also need `CARD_TYPES`, a machine, a detail model in `prisma/schema/details.prisma` plus a migration,
and `DETAIL_RELATION` and `DETAIL_DELEGATE` in `modules/cards/infrastructure/prisma-card.repository.ts`.

## Add an endpoint

```ts
@ApiTags('tasks')
@Controller('workspaces/:ws/tasks')
export class TasksController {
  constructor(private readonly cards: CardService) {}

  @Post(':key/claim')
  @Permissions('task.claim') // or @Public(). An arch test requires one of them.
  @ApiOkResponse({ type: CardWrittenDto })
  async claim(@Param('key') key: string, @Actor() actor: MemberActor, @Body() body: ClaimDto) {
    return toCardWritten(await this.cards.apply(actor, { cardKey: key }, 'task.claim', body));
  }
}
```

- `@Permissions` is the route-level check: could these roles ever do it? `apply` decides with the card in hand.
- DTOs are `createZodDto(schema)` over a schema from `@hub/contracts`. Share that schema with the MCP tool.
- Return plain values. The interceptor wraps them as `{ data, meta }`; return `{ items, pagination }` for a list. Throw
  `AppException('hub.x.y')`: add new codes to `packages/contracts/src/errors.ts` and to both `src/i18n/*/errors.json`.
- Run `pnpm api:sync` and commit `apps/web/openapi/openapi.json`, or `pnpm check` fails.
- Non-card mutations (members, settings, sources, projects) do not use `apply`, but must call `AuditService.record` inside
  their transaction.

## Add an MCP tool

`modules/mcp` (`docs/05` §2). To add one:

1. Add a row to `TOOL_TABLE` (`packages/contracts/src/mcp/tools.ts`): `description`, Zod `input` reusing the REST schema, the permission
   `actions`, and `routes`, the REST routes it stands for. `mcp-parity.spec.ts` fails when a mutating route has no tool, so a new web
   mutation needs a row, or a line in `MCP_EXCLUDED_ROUTES` saying why not. `project` is added for you.
2. `destructive: true` sets `destructiveHint` and tells Claude to confirm in the chat first. `createsCards: true` wraps it in
   `IdempotencyService.run`, keyed by the tool use id Claude Code sends.
3. Add the handler, in `presentation/mcp/tools/`. A missing one is a compile error. It gets `(context, input)` and returns Markdown stating
   what changed: `context.apply(verb, key, action, payload)` does the card case, the same call as the route. For a service that is not a
   card action, get the actor with `context.allowed('member.invite')`, since no `ActorGuard` ran the route-level check. Never touch Prisma
   (dependency-cruiser enforces this).
4. Secrets: the wrapper filters every input. A tool never takes a secret value.

Prompts are in `packages/contracts/src/mcp/prompts.ts`, resources in `hub-mcp-server.factory.ts`.

## Devices and the bridge

`modules/devices` (`docs/16` §4, §5, `docs/05` §9). A device is one machine running `hub-bridge` (`packages/bridge`), which connects out to `/bridge`. To ask a device for something:

```ts
await bridgeHub.request(deviceId, 'health.check'); // answers its one `result`, or throws hub.devices.offline, .timeout, .refused
await bridgeHub.request(deviceId, 'turn.start', args, {
  timeoutMs: null,
  onEvent: (event) => {
    /* every `event` frame, in order */
  },
});
```

Only `BRIDGE_ACTIONS` (`@hub/contracts`) can be sent, and the bridge refuses a folder off its allowlist. A device credential reaches only `/mcp`, `/bridge` and `DELETE /bridge/self`
(`deviceTokenMayCall`). A new action is a line in `BRIDGE_ACTIONS` and in `packages/bridge/lib/protocol.mjs`, a handler in `packages/bridge/lib/actions.mjs`, and a test.

## Chats

`modules/chats` (`docs/16` §7, "Slice 3 engine as built"). The API runs nothing: a turn is `bridgeHub.request(deviceId, 'turn.start', args, { timeoutMs: null, onEvent })`, and `TurnRecorder` writes what comes back. Three rules to keep:

- **Everything stored passes the secret filter first.** What the owner sends is refused with `assertNoSecrets`. What the engine produces is cleaned with `redactSecrets` and `redactDeep`, and streamed text with `createStreamRedactor`, since a secret can be split across pieces. All of them are in `@hub/contracts`.
- **`chat.run` and `chat.answer` are web only.** A token or an agent cannot start a chat or answer an approval, so a chat cannot approve itself.
- **Raw Claude Code events stop at `packages/bridge/lib/claude-events.mjs`.** A new engine fact is a new `TurnEvent` in `packages/contracts/src/chat.ts`, a line in the mapper, and a case in `TurnRecorder` and `apps/web/src/features/chat/live.ts`.

**Structured results** (`docs/16` §7.2 and "§7.2 as built"):

- `TurnRegistry.panelTurn(actor, toolUseId)` answers which panel turn an MCP call belongs to, from `_meta["claudecode/toolUseId"]`, or null. `ToolContext.toolUseId` holds it. Use it instead of a chat argument, which a model could fill in. `TurnRegistry.post(chatId, event)` puts a server-made event on the turn, in order with the bridge's.
- `WorkReportsService.report` judges checks in `domain/work-report.ts` (pure), then applies `card.report_work`, whose plan decides the move under the card's lock and runs `task.submit_review` as a follow-up. Read reports with `GET cards/:key/work-reports`, or `list_work_reports`.
- `DocDraftsService` holds `propose_doc` and the save behind it. `DocsWriteService.current` and `.similar` give it the base and the real duplicates.
- A new server-made result is a `TurnEvent`, a case in `TurnRecorder.write` and `reduceMessage`, and words in both `chat.json` files.

**Send to VS Code** (`docs/16` §8): `POST chats/vscode` with `{ device, folder, cardKey?, chatId? }` is session only. It checks the device is the member's and online, the folder is on the project's list, and the card exists, then builds the prompt itself with `vscodePrompt` and sends `vscode.open`. It answers `{ sent: true, prompt }`, and `sent` means handed over, never opened. The bridge runs the real program with no shell, and its refusals `vscode_missing`, `folder_missing` and `folder_not_allowed` each reach the browser as a localised error.

`RealtimePublisher.publishTransient` carries the stream: it skips the replay buffer, so a long reply cannot push card events out of it. `chat.changed` is the durable nudge, and `GET chats/:id` is the catch-up.

`E2E_REAL_CLAUDE=1 pnpm test:e2e chats-real-binary` runs the real bridge and binary in an isolated home with a scripted model, and costs no usage. Run it before widening `CLAUDE_MAX_VERSION`.

## The agent queue

`modules/agent-queue` (`docs/16` §9, "Slice 5 as built"). Postgres is the truth: `agent_runs` and `agent_queue_settings`. A run is a panel chat turn in Execute, started by `AgentQueueDispatcher` through `ChatsService.startForQueue`, so everything in § Chats applies to it.

- **One rule for holds.** `holdFor(run, gate)` in `domain/queue-rules.ts` says why a due run waits. The dispatcher starts what it lets through and the page shows its answer, so they cannot disagree. A new limit is a `HOLD_REASONS` entry in contracts, a line there, and words in `queue.json`.
- **It runs where the sockets are.** The tick (15 s, plus device ready, turn end and owner changes, one per member at a time) is off in `PROCESS_ROLE=worker`, and the timer is off in `QUEUE_MODE=inline`, so e2e tests call `tickAll()` themselves. BullMQ is not used: its delayed jobs would copy the schedule.
- **Turn facts** come from `ChatTurnEvents` (`onWaiting`, `onLimit`, `onEnded`), called after commit. Listen there rather than in the recorder.
- **Routes** under `/workspaces/:ws/queue`: `GET` is `queue.read` (and `list_queue`); `POST runs`, `runs/:id/pause|resume|cancel`, `order`, `pause` and `PATCH settings` are `queue.manage`, web only and `@SessionOnly`, so an agent cannot start agents or lift its own limits.
- Each change publishes `queue.changed` with `{ runId }` to the member; a run waiting on an approval writes a `system` inbox item, `run_waiting`, linking to the page.

## Writing docs

`DocsWriteService` is `save_doc` (`docs/16` §10): a stale base is refused, the earlier text becomes a `doc_revisions` row, and the file is written atomically, by the API or, when the source has `config.deviceId`, by the bridge. It commits nothing.

## Sources and local path mode

`SourceRunnerService` (`@/modules/system`) is the one way to run a `local_path` source: `open` then `finish`, or `POST /sources/{id}/run`.
`pnpm seed:sources` adds the folders of docs/15 §3, with the lab at `LAB_ROOT` or else `apps/lab`. `pnpm lab:repoint [--rescan]` moves an existing lab source there and rewrites stored version addresses; no card or key changes. Tests build temp copies; nothing may write to a real lab from a test.
An adapter that touches hundreds of cards sets `quiet: true` on its plans and announces the run itself. One whose truth lives elsewhere moves
the status with `plan.status`.

## Data access

- Inject `TransactionHost<PrismaTransactionalAdapter>` and use `.tx`, which joins the active transaction.
- Outside production, a query on a table with `workspace_id` and no scope predicate throws `WorkspaceScopeError`
  (`infra/prisma/workspace-scope.ts`). `findUnique({ where: { id, workspaceId } })` is fine.
  `runUnscoped(reason, fn)` is for the rare query that must cross projects, such as an invite looked up by its token.
- A new model with `workspaceId` goes in `WORKSPACE_SCOPED_MODELS`; an arch test checks it against the schema.

## Background work

Extend `BaseProcessor` (`infra/queue/queue.service.ts`), name a queue from `QUEUES`, implement `process`, add it to a module.
Workers start where `PROCESS_ROLE` is `worker` or `all`. In tests `QUEUE_MODE=inline` runs jobs in the caller's process.

Notifications: the routing table (`modules/notifications/domain/routing.ts`, docs/07 §1) reacts to every event, so a new action
usually needs nothing. Return `notify` from a plan for what the table cannot say; one member gets one item per event, the highest
kind wins. A new verb that does the work on a card is an act (`domain/acts.ts`), and clears that card for whoever did it; add its
inverse there if it has one. `OutboxProcessor.registerSender(channel, sender)` connects a channel; with no sender a job ends `skipped`.

Realtime: `CardService` publishes each card event after commit, so a card change reaches every open page with no work from
you. For anything else, `RealtimePublisher.publishEnvelope(workspaceId, { event, data, audience })`: `inbox.new` with
`{ userIds }`, `source.run` with `{ roles }`. Messages name what changed and carry no text; pages refetch through the API.

## Read cards

`CardQueryService` (`@/modules/cards`) is every read: `list`, `listWithDetail(actor, type, { where, sort, ... })` for a type's
page, `full`, `deleted`, `events`, `comments`, `timeline`, `summaries`. `actionsFor` and `awaitedAction` in `@hub/contracts` are
the one rule for what a card offers and whether it waits on a member; `GET /cards?awaiting=me` is that stack.
