# Carewell: hospital management (PERN + TypeScript + Tailwind)

One hospital per installation. Three parts:

| Folder | What |
| --- | --- |
| `server` | Node, Express, TypeScript, Prisma, PostgreSQL, Zod, JWT |
| `client` | React 18, Vite, Tailwind, TanStack Query: the staff app |
| `web` | Next.js marketing site with GSAP and Motion (installs on its own, see `web/README.md`) |

## Quick start

```bash
docker compose up -d                 # PostgreSQL 16 on :5432 (user/pass/db = hms)
npm install
cp server/.env.example server/.env
npm run db:push
npm run db:seed                      # departments, services, doctors, medicines, lab tests, wards, sample patients
npm run dev                          # API :4000, app :5173
```

The seed prints every login. All share the password `Care@12345` (change `SEED_PASSWORD`): `admin@`, `reception@`, `nurse@`, `pharmacy@`, `lab@`, `billing@care.local`, and doctors such as `prakash@care.local`.

**Before production:** set `JWT_SECRET` (32+ characters), `CLIENT_ORIGIN`, `CLINIC_TIMEZONE`, and change every seeded password.

## Modules

| Module | What it does |
| --- | --- |
| Departments | Eight sample departments with location and description; a department page lists its services and doctors |
| Services | Per-department services with duration and price, chosen at booking and added to the bill |
| Doctors | Profile, fee, linked login, weekly working hours and time away |
| Patients | Medical record number (MRN), allergies, blood group, emergency contact, insurance. Never deleted |
| Appointments | Live slot grid, booking, rescheduling, check-in, cancel, no-show |
| Visits | Vitals, complaint, diagnosis, notes, follow-up; prescriptions and lab orders; closing locks the record |
| Pharmacy | Medicines with stock and reorder level; prescriptions dispensed in full or not at all |
| Laboratory | Test catalogue; order, collect sample, enter result flagged normal, abnormal or critical |
| Wards and beds | Bed board, admit, discharge with summary, maintenance |
| Billing | Invoices from a visit, a stay, or by hand; cash, card, insurance and online payments |
| Administration | Users and roles, audit log |

## How appointment booking works

- A doctor's **working hours** (day, start, end, slot length) generate the slots. Hours are read in `CLINIC_TIMEZONE` and stored as UTC.
- A slot is unavailable when it is already booked, in the past, or inside the doctor's **time away**.
- Booking stores a `slotKey` (`doctor|start time`) with a **unique index**, so two simultaneous requests cannot hold the same slot; the second gets a clear 409. Cancelling or marking a no-show clears the key and frees the slot.
- A patient cannot hold two appointments at the same time.
- Status flow: scheduled → checked in → in progress → completed, with cancel and no-show on the way. Each move is guarded by the current status, so two people clicking at once cannot both win.
- Doctors with a linked login only see their own appointments and visits.

## Other guarantees

- Dispensing decreases stock with a guarded update that fails if stock is short, inside one transaction.
- Payments cannot exceed the balance; money is computed in whole cents.
- A bed is claimed with a guarded update, so it cannot hold two patients.
- A closed visit cannot be edited. Bookings, dispensing, payments and other key actions are written to the audit log.

## Roles

`ADMIN` can do everything. Others are listed in `server/src/lib/permissions.ts` (enforced by the API) and mirrored in `client/src/lib/access.ts` (menus only).

| Role | Main access |
| --- | --- |
| DOCTOR | Own appointments and visits, prescriptions, lab orders, admissions |
| NURSE | Check-in, vitals, wards, patient registration |
| RECEPTIONIST | Patients, booking, check-in, admissions, invoices and payments |
| PHARMACIST | Prescriptions to dispense, medicines and stock |
| LAB_TECH | Lab orders, samples, results, lab tests |
| BILLING | Invoices and payments |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | API and app with hot reload |
| `npm run typecheck` | Type-check both workspaces |
| `npm test` | Unit tests for slot arithmetic and money (no database needed) |
| `npm run db:push` / `db:seed` | Create tables, load sample data |

## Not included yet

Patient self-service portal, SMS or email reminders, insurance claim processing, medical imaging storage, multiple branches or tenants, and broad automated tests (the slot and money logic is tested; the API routes have not been run against a database in automated tests).
