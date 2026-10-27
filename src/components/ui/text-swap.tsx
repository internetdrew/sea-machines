'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

type TextSwapProps = {
  text: string;
  className?: string;
  /** Duration of each exit and entrance, in seconds. */
  duration?: number;
  offset?: number;
  blur?: number;
};

export function TextSwap({
  text,
  className,
  duration = 0.15,
  offset = 4,
  blur = 2,
}: TextSwapProps) {
  const reducedMotion = useReducedMotion();

  return (
    <span
      className={`relative inline-flex whitespace-nowrap ${className ?? ''}`}
    >
      <span className='sr-only'>{text}</span>
      {reducedMotion ? (
        <span aria-hidden='true'>{text}</span>
      ) : (
        <AnimatePresence initial={false} mode='popLayout'>
          <motion.span
            key={text}
            aria-hidden='true'
            className='inline-block'
            initial={{ y: offset, filter: `blur(${blur}px)`, opacity: 0 }}
            animate={{ y: 0, filter: 'blur(0px)', opacity: 1 }}
            exit={{
              y: -offset,
              filter: `blur(${blur}px)`,
              opacity: 0,
              transition: { duration, ease: 'easeInOut', delay: 0 },
            }}
            transition={{ duration, ease: 'easeInOut', delay: duration }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      )}
    </span>
  );
}
