'use client';

import { MotionConfig } from 'motion/react';

/** Motion skips transform animations for people who ask their OS for reduced motion. */
export default function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
