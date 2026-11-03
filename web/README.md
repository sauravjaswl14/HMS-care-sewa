# Carewell website

Next.js 15 (App Router) + TypeScript + Tailwind CSS 3, animated with **GSAP** and **Motion**.

```bash
cd web
npm install
cp .env.example .env.local     # NEXT_PUBLIC_APP_URL = where the Carewell client runs
npm run dev                    # http://localhost:3000
npm run build && npm start
```

"Open Carewell" links to `NEXT_PUBLIC_APP_URL/login`. Rebrand in `src/lib/site.ts`. `web` installs on its own, outside the root npm workspaces. Fonts (Bricolage Grotesque, Public Sans, JetBrains Mono) are self-hosted through fontsource, so builds need no network.

## Design

An ECG line is the spine of the page: it beats in the hero monitor, draws itself between sections, and runs down the patient timeline. Palette: light-box white, ink, scrub green, monitor red and wristband yellow.

## Who animates what

| Library | Used for |
| --- | --- |
| GSAP + ScrollTrigger | Hero monitor trace and parallax, pinned horizontal walk through the departments, scroll-drawn heartbeats, patient timeline, scroll-read statements, closing parallax |
| Motion | Hero entrance, header hide on scroll, booking demo (shared-layout tab underline, slot springs, ticket), module tiles, accordion, hover springs |
| Lenis | Smooth scrolling, driven by GSAP's ticker |

Reduced motion: GSAP animations and smooth scrolling are skipped, Motion skips transforms, and the department walk becomes a normal two-column grid. Below 1024px the walk is a vertical list.

## Samples

Doctors, vitals and figures are made-up samples and are labelled as such. Department names, locations and services match the seed data in the app.
