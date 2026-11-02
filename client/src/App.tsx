import { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { canRead, Module } from './lib/access';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/appointments';
import { Patients, PatientDetail } from './pages/patients';
import { Departments, DepartmentDetail, Doctors, Services } from './pages/catalog';
import { VisitDetail, Visits } from './pages/visits';
import { Medicines, Prescriptions } from './pages/pharmacy';
import { LabOrders, LabTests } from './pages/lab';
import { Admissions, Wards } from './pages/wards';
import { Invoices } from './pages/billing';
import { AuditLog, Users } from './pages/admin';

function Guard({ module, children }: { module: Module; children: ReactElement }) {
  const { user } = useAuth();
  const allowed = module === 'admin' ? user?.role === 'ADMIN' : canRead(user?.role, module);
  if (!allowed) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
        <h1 className="text-lg font-semibold text-slate-900">No access</h1>
        <p className="mt-1 text-sm text-slate-500">Your role does not include this page. Ask an administrator if you need it.</p>
      </div>
    );
  }
  return children;
}

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

const g = (module: Module, el: ReactElement) => <Guard module={module}>{el}</Guard>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route index element={<Dashboard />} />

        <Route path="appointments" element={g('appointments', <Appointments />)} />
        <Route path="patients" element={g('patients', <Patients />)} />
        <Route path="patients/:id" element={g('patients', <PatientDetail />)} />

        <Route path="visits" element={g('encounters', <Visits />)} />
        <Route path="visits/:id" element={g('encounters', <VisitDetail />)} />
        <Route path="lab/orders" element={g('lab', <LabOrders />)} />
        <Route path="lab/tests" element={g('lab', <LabTests />)} />
        <Route path="wards" element={g('wards', <Wards />)} />
        <Route path="admissions" element={g('wards', <Admissions />)} />

        <Route path="pharmacy/prescriptions" element={g('prescriptions', <Prescriptions />)} />
        <Route path="pharmacy/medicines" element={g('pharmacy', <Medicines />)} />

        <Route path="billing/invoices" element={g('billing', <Invoices />)} />

        <Route path="departments" element={g('catalog', <Departments />)} />
        <Route path="departments/:id" element={g('catalog', <DepartmentDetail />)} />
        <Route path="services" element={g('catalog', <Services />)} />
        <Route path="doctors" element={g('catalog', <Doctors />)} />

        <Route path="admin/users" element={g('admin', <Users />)} />
        <Route path="admin/audit" element={g('admin', <AuditLog />)} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
