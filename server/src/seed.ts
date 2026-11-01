import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { prisma } from './lib/prisma';
import { nextNumber } from './lib/numbers';

/** Sample hospital. Every name and number is made up. Safe to run again: it never duplicates or overwrites existing rows. */
const PASSWORD = process.env.SEED_PASSWORD ?? 'Care@12345';

const DEPARTMENTS = [
  { code: 'GEN', name: 'General Medicine', location: 'Block A, Ground floor', description: 'First point of care for adults: check-ups, fevers, chronic conditions.' },
  { code: 'CARD', name: 'Cardiology', location: 'Block B, 2nd floor', description: 'Heart and blood pressure care, with ECG and echo on site.' },
  { code: 'PED', name: 'Paediatrics', location: 'Block A, 1st floor', description: 'Care for babies, children and teenagers, including vaccinations.' },
  { code: 'ORTH', name: 'Orthopaedics', location: 'Block C, Ground floor', description: 'Bones, joints and sports injuries.' },
  { code: 'OBG', name: 'Obstetrics & Gynaecology', location: 'Block B, 1st floor', description: 'Pregnancy care, delivery and women’s health.' },
  { code: 'DERM', name: 'Dermatology', location: 'Block A, 2nd floor', description: 'Skin, hair and nail conditions.' },
  { code: 'ER', name: 'Emergency', location: 'Main entrance', description: 'Open all day and night for urgent and life-threatening problems.' },
  { code: 'RAD', name: 'Radiology', location: 'Block C, Basement', description: 'X-ray, ultrasound and CT imaging.' },
];

const SERVICES: Record<string, [string, string, number, number][]> = {
  GEN: [['GEN-CONS', 'General consultation', 20, 40], ['GEN-CHECK', 'Full health check-up', 60, 180], ['GEN-VAX', 'Adult vaccination', 15, 35]],
  CARD: [['CARD-CONS', 'Cardiology consultation', 30, 90], ['CARD-ECG', 'ECG', 15, 45], ['CARD-ECHO', 'Echocardiogram', 45, 220], ['CARD-TMT', 'Treadmill stress test', 45, 200]],
  PED: [['PED-CONS', 'Child consultation', 20, 45], ['PED-VAX', 'Childhood vaccination', 15, 30], ['PED-GROW', 'Growth and development review', 30, 60]],
  ORTH: [['ORTH-CONS', 'Orthopaedic consultation', 30, 80], ['ORTH-CAST', 'Cast application', 40, 120], ['ORTH-INJ', 'Joint injection', 30, 150]],
  OBG: [['OBG-ANC', 'Antenatal check', 30, 70], ['OBG-USG', 'Pregnancy ultrasound', 30, 110], ['OBG-PAP', 'Cervical screening', 20, 60]],
  DERM: [['DERM-CONS', 'Skin consultation', 20, 65], ['DERM-BIOPSY', 'Skin biopsy', 30, 140], ['DERM-PEEL', 'Chemical peel', 45, 160]],
  ER: [['ER-TRIAGE', 'Emergency assessment', 30, 90], ['ER-SUTURE', 'Wound closure', 30, 110]],
  RAD: [['RAD-XRAY', 'X-ray', 15, 50], ['RAD-USG', 'Ultrasound scan', 30, 100], ['RAD-CT', 'CT scan', 30, 380]],
};

// [name, specialization, dept, licence, fee, email prefix, weekdays, start, end, slot]
const DOCTORS: [string, string, string, string, number, string, number[], string, string, number][] = [
  ['Dr. Anita Rai', 'Internal medicine', 'GEN', 'MC-10021', 40, 'anita', [1, 2, 3, 4, 5], '09:00', '13:00', 20],
  ['Dr. Suman Thapa', 'Family medicine', 'GEN', 'MC-10048', 40, 'suman', [1, 3, 5, 6], '14:00', '18:00', 20],
  ['Dr. Prakash Sharma', 'Interventional cardiology', 'CARD', 'MC-10133', 90, 'prakash', [1, 2, 4], '10:00', '15:00', 30],
  ['Dr. Maya Gurung', 'Paediatrics', 'PED', 'MC-10210', 45, 'maya', [1, 2, 3, 4, 5], '09:00', '12:30', 15],
  ['Dr. Rajan Karki', 'Orthopaedic surgery', 'ORTH', 'MC-10307', 80, 'rajan', [2, 3, 5], '11:00', '16:00', 30],
  ['Dr. Sita Shrestha', 'Obstetrics and gynaecology', 'OBG', 'MC-10412', 70, 'sita', [1, 3, 4, 6], '09:30', '14:00', 30],
  ['Dr. Binod Adhikari', 'Dermatology', 'DERM', 'MC-10519', 65, 'binod', [2, 4, 5], '13:00', '17:00', 20],
  ['Dr. Kiran Lama', 'Emergency medicine', 'ER', 'MC-10604', 90, 'kiran', [0, 1, 2, 3, 4, 5, 6], '08:00', '16:00', 30],
];

const MEDICINES: [string, string, string, string, string, number, number, number][] = [
  ['MED-PARA500', 'Paracetamol', 'Acetaminophen', 'Tablet', '500 mg', 0.05, 800, 200],
  ['MED-AMOX500', 'Amoxicillin', 'Amoxicillin', 'Capsule', '500 mg', 0.4, 400, 100],
  ['MED-IBU400', 'Ibuprofen', 'Ibuprofen', 'Tablet', '400 mg', 0.1, 500, 150],
  ['MED-OMEP20', 'Omeprazole', 'Omeprazole', 'Capsule', '20 mg', 0.15, 300, 100],
  ['MED-METF500', 'Metformin', 'Metformin', 'Tablet', '500 mg', 0.08, 600, 150],
  ['MED-AMLO5', 'Amlodipine', 'Amlodipine', 'Tablet', '5 mg', 0.12, 350, 100],
  ['MED-ATOR20', 'Atorvastatin', 'Atorvastatin', 'Tablet', '20 mg', 0.25, 90, 100],
  ['MED-CETI10', 'Cetirizine', 'Cetirizine', 'Tablet', '10 mg', 0.06, 450, 120],
  ['MED-ORS', 'Oral rehydration salts', 'ORS', 'Sachet', '20.5 g', 0.3, 250, 80],
  ['MED-SALB', 'Salbutamol inhaler', 'Salbutamol', 'Inhaler', '100 mcg', 4.5, 40, 25],
];

const LAB_TESTS: [string, string, number, string, string][] = [
  ['CBC', 'Complete blood count', 18, 'Blood', 'WBC 4–11 ×10⁹/L, Hb 12–17 g/dL'],
  ['FBS', 'Fasting blood sugar', 8, 'Blood', '70–99 mg/dL'],
  ['HBA1C', 'HbA1c', 22, 'Blood', 'Below 5.7 %'],
  ['LIPID', 'Lipid profile', 25, 'Blood', 'LDL below 100 mg/dL'],
  ['LFT', 'Liver function tests', 28, 'Blood', 'ALT 7–56 U/L'],
  ['URINE', 'Urine routine', 10, 'Urine', 'No protein, no glucose'],
  ['CRP', 'C-reactive protein', 15, 'Blood', 'Below 5 mg/L'],
];

const WARDS: [string, string, string, number, number][] = [
  ['General Ward', 'General', 'GEN', 8, 25],
  ['Maternity Ward', 'Maternity', 'OBG', 4, 45],
  ['Cardiac Care Unit', 'Intensive care', 'CARD', 4, 140],
];

const PATIENTS: [string, string, string, string, string, string, string][] = [
  ['Sanjay', 'Basnet', '1985-04-12', 'MALE', '9800000001', 'O+', 'Penicillin'],
  ['Pooja', 'Khadka', '1992-09-30', 'FEMALE', '9800000002', 'A+', ''],
  ['Arjun', 'Maharjan', '2018-02-14', 'MALE', '9800000003', 'B+', ''],
  ['Laxmi', 'Tamang', '1958-11-03', 'FEMALE', '9800000004', 'AB+', 'Sulfa drugs'],
  ['Bikash', 'Oli', '1977-06-21', 'MALE', '9800000005', 'O-', ''],
  ['Nisha', 'Pandey', '2001-01-19', 'FEMALE', '9800000006', 'A-', ''],
];

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 12);

  // Staff accounts, one per role.
  const staff: [string, string, Role][] = [
    ['admin@care.local', 'Hospital Admin', 'ADMIN'],
    ['reception@care.local', 'Rina Receptionist', 'RECEPTIONIST'],
    ['nurse@care.local', 'Nabin Nurse', 'NURSE'],
    ['pharmacy@care.local', 'Pema Pharmacist', 'PHARMACIST'],
    ['lab@care.local', 'Lalit Lab Technician', 'LAB_TECH'],
    ['billing@care.local', 'Bina Billing', 'BILLING'],
  ];
  for (const [email, name, role] of staff) {
    await prisma.user.upsert({ where: { email }, update: {}, create: { email, name, role, passwordHash: hash } });
  }

  const dept: Record<string, string> = {};
  for (const d of DEPARTMENTS) {
    dept[d.code] = (await prisma.department.upsert({ where: { code: d.code }, update: {}, create: d })).id;
  }
  for (const [code, list] of Object.entries(SERVICES)) {
    for (const [sc, name, durationMin, price] of list) {
      await prisma.service.upsert({ where: { code: sc }, update: {}, create: { code: sc, name, durationMin, price, departmentId: dept[code] } });
    }
  }

  for (const [name, specialization, d, licenseNo, fee, prefix, days, start, end, slot] of DOCTORS) {
    const email = `${prefix}@care.local`;
    const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email, name, role: 'DOCTOR', passwordHash: hash } });
    const doc = await prisma.doctor.upsert({
      where: { licenseNo },
      update: {},
      create: { name, specialization, licenseNo, email, consultationFee: fee, departmentId: dept[d], userId: user.id },
    });
    if ((await prisma.doctorSchedule.count({ where: { doctorId: doc.id } })) === 0) {
      await prisma.doctorSchedule.createMany({ data: days.map((weekday) => ({ doctorId: doc.id, weekday, startTime: start, endTime: end, slotMinutes: slot })) });
    }
  }

  for (const [sku, name, genericName, form, strength, unitPrice, stock, reorderLevel] of MEDICINES) {
    await prisma.medicine.upsert({ where: { sku }, update: {}, create: { sku, name, genericName, form, strength, unitPrice, stock, reorderLevel } });
  }
  for (const [code, name, price, sampleType, normalRange] of LAB_TESTS) {
    await prisma.labTest.upsert({ where: { code }, update: {}, create: { code, name, price, sampleType, normalRange } });
  }

  for (const [name, kind, d, beds, rate] of WARDS) {
    const ward = await prisma.ward.upsert({ where: { name }, update: {}, create: { name, kind, departmentId: dept[d] } });
    for (let i = 1; i <= beds; i++) {
      const number = `${name.split(' ').map((w) => w[0]).join('')}-${String(i).padStart(2, '0')}`;
      await prisma.bed.upsert({ where: { wardId_number: { wardId: ward.id, number } }, update: {}, create: { wardId: ward.id, number, dailyRate: rate } });
    }
  }

  if ((await prisma.patient.count()) === 0) {
    for (const [firstName, lastName, dob, gender, phone, bloodGroup, allergies] of PATIENTS) {
      await prisma.$transaction(async (tx) =>
        tx.patient.create({
          data: {
            mrn: await nextNumber(tx, 'patient', 'MRN'),
            firstName,
            lastName,
            dateOfBirth: new Date(dob),
            gender: gender as 'MALE' | 'FEMALE',
            phone,
            bloodGroup,
            allergies: allergies || null,
            address: 'Kathmandu',
          },
        }),
      );
    }
  }

  console.log('Seeded. Sign in with any of these (password %s):', PASSWORD);
  console.log([...staff.map((s) => s[0]), ...DOCTORS.map((d) => `${d[5]}@care.local`)].join('\n'));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
