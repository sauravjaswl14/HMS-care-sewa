/** Product name and links, in one place. Change SITE.name to rebrand. */
export const SITE = {
  name: 'Carewell',
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
} as const;

export const LINKS = { login: `${SITE.appUrl}/login` } as const;
