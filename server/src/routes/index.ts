import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authRouter } from './auth';
import { usersRouter } from './users';
import { resourcesRouter } from './resources';
import { appointmentsRouter } from './appointments';
import { clinicalRouter } from './clinical';
import { inpatientRouter } from './inpatient';
import { billingRouter } from './billing';
import { dashboardRouter } from './dashboard';
import { auditRouter } from './audit';

export const routes = Router();

routes.get('/health', (_req, res) => res.json({ status: 'ok' }));
routes.use('/auth', authRouter);

// Everything below requires a valid session.
routes.use(authenticate);
routes.use('/dashboard', dashboardRouter);
routes.use('/users', usersRouter);
routes.use('/audit-logs', auditRouter);
routes.use('/appointments', appointmentsRouter);
routes.use('/', clinicalRouter);
routes.use('/', inpatientRouter);
routes.use('/', billingRouter);
routes.use('/', resourcesRouter);
