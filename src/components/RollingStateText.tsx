import { motion, useReducedMotion } from 'motion/react';

/** Two persistent labels keep the roll interruptible during rapid state changes. */
export function RollingStateText({ active, labelA, labelB }: {
  active: boolean;
  labelA: string;
  labelB: string;
}) {
  const reducedMotion = useReducedMotion();
  const duration = reducedMotion ? 0 : 0.15;
  const outgoing = { duration, ease: 'easeInOut' as const, delay: 0 };
  const incoming = { duration, ease: 'easeInOut' as const, delay: duration };
  return <span className='relative inline-grid overflow-hidden align-middle' aria-hidden='true'>
    <span className='invisible col-start-1 row-start-1 whitespace-nowrap'>{labelA}</span>
    <span className='invisible col-start-1 row-start-1 whitespace-nowrap'>{labelB}</span>
    <motion.span initial={false} animate={{ transform: active ? 'translateY(100%)' : 'translateY(0%)' }} transition={active ? outgoing : incoming} className='absolute inset-0 block whitespace-nowrap text-center'>
      {labelA}
    </motion.span>
    <motion.span initial={false} animate={{ transform: active ? 'translateY(0%)' : 'translateY(-100%)' }} transition={active ? incoming : outgoing} className='absolute inset-0 block whitespace-nowrap text-center'>
      {labelB}
    </motion.span>
  </span>;
}
