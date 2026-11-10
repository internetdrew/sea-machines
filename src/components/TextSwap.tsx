'use client';

import type { ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

type TextSwapProps = {
  text: string;
  children?: ReactNode;
  className?: string;
  animateWidth?: boolean;
  /** Duration of each exit and entrance, in seconds. */
  duration?: number;
  offset?: number;
  blur?: number;
};

export function TextSwap({
  text,
  children,
  className,
  animateWidth = false,
  duration = 0.15,
  offset = 4,
  blur = 2,
}: TextSwapProps) {
  const reducedMotion = useReducedMotion();
  const measure = useRef<HTMLSpanElement | null>(null);
  const [width, setWidth] = useState<number | undefined>();
  useLayoutEffect(() => {
    if (!animateWidth || !measure.current) return;
    const element = measure.current;
    const update = () => setWidth(element.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [animateWidth]);

  return (
    <motion.span
      initial={false}
      animate={animateWidth && width !== undefined ? { width } : {}}
      transition={{ type: 'spring', stiffness: 600, damping: 40, ...(reducedMotion ? { duration: 0 } : {}) }}
      className={`relative inline-flex justify-center whitespace-nowrap ${className ?? ''}`}
    >
      <span className='sr-only'>{text}</span>
      {animateWidth && <span ref={measure} aria-hidden='true' className='pointer-events-none invisible absolute left-0 top-0 inline-flex w-max'>{children ?? text}</span>}
      {reducedMotion ? (
        <span aria-hidden='true'>{children ?? text}</span>
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
            {children ?? text}
          </motion.span>
        </AnimatePresence>
      )}
    </motion.span>
  );
}
