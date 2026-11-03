import { SITE, LINKS } from '@/lib/site';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="bg-ink py-14 text-paper">
      <div className="mx-auto flex max-w-[88rem] flex-col gap-10 px-5 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm text-paper/70">Doctors, patients, vitals and figures on this page are samples made up for illustration.</p>
        </div>
        <a className="text-[0.95rem] hover:underline" href={LINKS.login}>Sign in</a>
      </div>
      <p className="mx-auto mt-10 max-w-[88rem] px-5 text-xs text-paper/50 sm:px-8">© {new Date().getFullYear()} {SITE.name}</p>
    </footer>
  );
}
