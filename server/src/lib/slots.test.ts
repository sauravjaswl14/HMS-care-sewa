import test from 'node:test';
import assert from 'node:assert/strict';
import { APPOINTMENT_FLOW, buildDaySlots, slotsForBlock, toZoned, weekdayOf, zonedToUtc } from './slots';

test('slotsForBlock only returns slots that fit', () => {
  assert.deepEqual(slotsForBlock({ startTime: '09:00', endTime: '10:00', slotMinutes: 20 }), ['09:00', '09:20', '09:40']);
  assert.deepEqual(slotsForBlock({ startTime: '09:00', endTime: '10:10', slotMinutes: 30 }), ['09:00', '09:30']);
  assert.deepEqual(slotsForBlock({ startTime: '10:00', endTime: '09:00', slotMinutes: 20 }), []);
});

test('weekdayOf', () => {
  assert.equal(weekdayOf('2026-11-02'), 1); // Monday
  assert.equal(weekdayOf('2026-11-01'), 0);
  assert.throws(() => weekdayOf('2026-02-30'));
  assert.throws(() => weekdayOf('nope'));
});

test('zonedToUtc and toZoned round-trip across zones', () => {
  assert.equal(zonedToUtc('2026-11-02', '09:00', 'UTC').toISOString(), '2026-11-02T09:00:00.000Z');
  // Nepal is UTC+05:45
  assert.equal(zonedToUtc('2026-11-02', '09:00', 'Asia/Katmandu').toISOString(), '2026-11-02T03:15:00.000Z');
  // New York is UTC-5 in November (after DST ends) and UTC-4 in July
  assert.equal(zonedToUtc('2026-11-02', '09:00', 'America/New_York').toISOString(), '2026-11-02T14:00:00.000Z');
  assert.equal(zonedToUtc('2026-07-01', '09:00', 'America/New_York').toISOString(), '2026-07-01T13:00:00.000Z');
  const z = toZoned(new Date('2026-11-02T03:15:00Z'), 'Asia/Katmandu');
  assert.deepEqual(z, { date: '2026-11-02', time: '09:00', weekday: 1 });
});

test('buildDaySlots marks booked, past and time-off slots', () => {
  const blocks = [{ startTime: '09:00', endTime: '10:00', slotMinutes: 20 }];
  const slots = buildDaySlots({
    date: '2026-11-02',
    tz: 'UTC',
    blocks,
    booked: [new Date('2026-11-02T09:20:00Z')],
    timeOff: [{ startsAt: new Date('2026-11-02T09:40:00Z'), endsAt: new Date('2026-11-02T11:00:00Z') }],
    now: new Date('2026-11-02T08:00:00Z'),
  });
  assert.deepEqual(
    slots.map((s) => [s.time, s.available, s.reason]),
    [
      ['09:00', true, undefined],
      ['09:20', false, 'booked'],
      ['09:40', false, 'time_off'],
    ],
  );
  const past = buildDaySlots({ date: '2026-11-02', tz: 'UTC', blocks, booked: [], timeOff: [], now: new Date('2026-11-02T09:10:00Z') });
  assert.deepEqual(past.map((s) => s.reason), ['past', undefined, undefined]);
});

test('overlapping schedule rows do not duplicate slots', () => {
  const slots = buildDaySlots({
    date: '2026-11-02',
    tz: 'UTC',
    blocks: [
      { startTime: '09:00', endTime: '10:00', slotMinutes: 30 },
      { startTime: '09:30', endTime: '11:00', slotMinutes: 30 },
    ],
    booked: [],
    timeOff: [],
    now: new Date('2026-01-01T00:00:00Z'),
  });
  assert.deepEqual(slots.map((s) => s.time), ['09:00', '09:30', '10:00', '10:30']);
});

test('appointment flow forbids reopening finished visits', () => {
  assert.ok(APPOINTMENT_FLOW.SCHEDULED.includes('CHECKED_IN'));
  assert.ok(!APPOINTMENT_FLOW.COMPLETED.includes('SCHEDULED'));
  assert.ok(!APPOINTMENT_FLOW.CANCELLED.includes('SCHEDULED'));
});
