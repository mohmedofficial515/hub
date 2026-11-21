/**
 * @file The Prisma reader against small schemas and, when the Goteav backend is on this machine, against its real files.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parsePrismaFiles, readAttributes } from './prisma-parse';
import { diffSchemas } from './snapshot-diff';

const SAMPLE = `// Bookings context: the booking and its notes.

datasource db {
  provider = "postgresql"
}

enum BookingStatus {
  DRAFT
  /// Paid in full.
  PAID // after the gateway's webhook
  @@map("booking_status")
}

/// A customer's booking.
model Booking {
  id        String        @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  reference String        @unique @db.VarChar(12)
  status    BookingStatus @default(DRAFT)
  userId    String?       @map("user_id") @db.Uuid
  user      User?         @relation(fields: [userId], references: [id], onDelete: SetNull)
  notes     BookingNote[]
  note      String?       // free text, "quoted // not a comment"

  @@index([userId, status(sort: Desc)], map: "bookings_user_status")
  @@map("bookings")
}

model BookingNote {
  id        String  @id
  bookingId String  @map("booking_id")
  booking   Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)
}

model User {
  id       String    @id
  bookings Booking[]
  profile  Profile?
}

model Profile {
  id     String @id
  userId String @unique
  user   User   @relation(fields: [userId], references: [id])
}
`;

describe('parsePrismaFiles', () => {
  const doc = parsePrismaFiles([{ path: 'prisma/schema/bookings.prisma', text: SAMPLE }]);

  it('reads the domain, its header, models and enums', () => {
    expect(doc.provider).toBe('postgresql');
    expect(doc.domains).toEqual([
      {
        name: 'bookings',
        file: 'prisma/schema/bookings.prisma',
        header: 'Bookings context: the booking and its notes.',
        models: ['Booking', 'BookingNote', 'User', 'Profile'],
        enums: ['BookingStatus'],
      },
    ]);
    expect(doc.warnings).toEqual([]);
  });

  it('reads fields with their attributes, docs and trailing comments', () => {
    const booking = doc.models.find((model) => model.name === 'Booking');
    expect(booking?.dbName).toBe('bookings');
    expect(booking?.doc).toBe("A customer's booking.");
    const id = booking?.fields.find((field) => field.name === 'id');
    expect(id).toMatchObject({
      isId: true,
      nativeType: 'Uuid',
      default: 'dbgenerated("uuid_generate_v7()")',
      kind: 'scalar',
    });
    expect(booking?.fields.find((field) => field.name === 'status')).toMatchObject({
      kind: 'enum',
      default: 'DRAFT',
    });
    expect(booking?.fields.find((field) => field.name === 'userId')).toMatchObject({
      dbName: 'user_id',
      optional: true,
      isForeignKey: true,
    });
    expect(booking?.fields.find((field) => field.name === 'notes')).toMatchObject({
      kind: 'relation',
      list: true,
      type: 'BookingNote[]',
    });
    expect(booking?.fields.find((field) => field.name === 'note')?.comment).toBe(
      'free text, "quoted // not a comment"',
    );
    expect(booking?.indexes).toEqual([
      {
        kind: 'index',
        fields: ['userId', 'status'],
        name: 'bookings_user_status',
        raw: 'index([userId, status(sort: Desc)], map: "bookings_user_status")',
      },
    ]);
  });

  it('reads enum values with their map, doc and comment', () => {
    expect(doc.enums[0]).toMatchObject({
      name: 'BookingStatus',
      dbName: 'booking_status',
      values: [
        { name: 'DRAFT', dbName: null, doc: null, comment: null },
        { name: 'PAID', dbName: null, doc: 'Paid in full.', comment: "after the gateway's webhook" },
      ],
    });
  });

  it('finds relations, their back fields and cardinality', () => {
    const byId = Object.fromEntries(doc.relations.map((relation) => [relation.id, relation]));
    expect(byId['Booking.user']).toMatchObject({
      to: 'User',
      toField: 'bookings',
      cardinality: 'many_to_one',
      onDelete: 'SetNull',
      optional: true,
    });
    expect(byId['BookingNote.booking']).toMatchObject({
      to: 'Booking',
      toField: 'notes',
      cardinality: 'many_to_one',
    });
    expect(byId['Profile.user']).toMatchObject({ to: 'User', toField: 'profile', cardinality: 'one_to_one' });
    expect(doc.stats).toMatchObject({ models: 4, enums: 1, relations: 3 });
  });

  it('opens a block whose line ends with a comment, as Hub’s own SessionLog does', () => {
    const text = [
      'model SessionLog {                                       // one row per Claude Code session',
      '  id        String @id',
      '  summary   String? // what the session did',
      '}   // end of SessionLog',
      '',
      'enum Kind { // how it was seen',
      '  HOOK',
      '}',
    ].join('\n');
    const parsed = parsePrismaFiles([{ path: 'capture.prisma', text }]);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.models[0]).toMatchObject({
      name: 'SessionLog',
      comment: 'one row per Claude Code session',
      line: 1,
    });
    expect(parsed.models[0]?.fields.map((field) => field.name)).toEqual(['id', 'summary']);
    expect(parsed.enums[0]).toMatchObject({ name: 'Kind', comment: 'how it was seen' });
    expect(parsed.enums[0]?.values.map((value) => value.name)).toEqual(['HOOK']);
  });

  it('reads Hub’s own schema with no warnings', () => {
    const own = join(__dirname, '../../../../prisma/schema');
    const files = readdirSync(own)
      .filter((name) => name.endsWith('.prisma'))
      .map((name) => ({ path: `prisma/schema/${name}`, text: readFileSync(join(own, name), 'utf8') }));
    const parsed = parsePrismaFiles(files);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.models.some((model) => model.name === 'SessionLog')).toBe(true);
    const all = files.map((file) => file.text).join('\n');
    expect(parsed.stats.models).toBe((all.match(/^model /gm) ?? []).length);
  });

  it('turns a line it cannot read into a warning', () => {
    const broken = parsePrismaFiles([{ path: 'x.prisma', text: 'model A {\n  id Int @id\n  ???\n}\n' }]);
    expect(broken.models[0]?.fields).toHaveLength(1);
    expect(broken.warnings).toEqual(['x.prisma:3: not read: ???']);
  });
});

describe('readAttributes', () => {
  it('keeps quoted brackets and nested calls together', () => {
    expect(
      readAttributes('@default(dbgenerated("f(\\"x\\")")) @db.VarChar(64) @map("a)b")').map((a) => a.raw),
    ).toEqual(['default(dbgenerated("f(\\"x\\")"))', 'db.VarChar(64)', 'map("a)b")']);
  });
});

describe('diffSchemas', () => {
  it('names what was added, removed and changed', () => {
    const before = parsePrismaFiles([
      {
        path: 'a.prisma',
        text: 'model A {\n  id Int @id\n  x String\n}\nmodel B {\n  id Int @id\n}\nenum E {\n  ONE\n}\n',
      },
    ]);
    const after = parsePrismaFiles([
      {
        path: 'a.prisma',
        text: 'model A {\n  id Int @id\n  x String?\n  y Int\n}\nmodel C {\n  id Int @id\n}\nenum E {\n  ONE\n  TWO\n}\n',
      },
    ]);
    expect(diffSchemas(before, after)).toEqual({
      addedModels: ['C'],
      removedModels: ['B'],
      changedModels: ['A'],
      addedFields: ['A.y'],
      removedFields: [],
      changedFields: ['A.x'],
      addedEnums: [],
      removedEnums: [],
      changedEnums: ['E'],
    });
  });
});

const BACKEND = 'F:/Goteav/backend/prisma/schema';
(existsSync(BACKEND) ? describe : describe.skip)('the Goteav backend schema', () => {
  it('reads every model and enum with no warnings', () => {
    const files = readdirSync(BACKEND)
      .filter((name) => name.endsWith('.prisma'))
      .map((name) => ({ path: `prisma/schema/${name}`, text: readFileSync(join(BACKEND, name), 'utf8') }));
    const text = files.map((file) => file.text).join('\n');
    const doc = parsePrismaFiles(files);
    expect(doc.warnings).toEqual([]);
    expect(doc.stats.models).toBe((text.match(/^model /gm) ?? []).length);
    expect(doc.stats.enums).toBe((text.match(/^enum /gm) ?? []).length);
    expect(doc.stats.relations).toBeGreaterThan(50);
    for (const relation of doc.relations)
      expect(doc.models.some((model) => model.name === relation.to)).toBe(true);
  });
});
