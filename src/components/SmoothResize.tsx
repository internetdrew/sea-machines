import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/** Measure the natural content width independently of its animated container. */
export function SmoothResize({ children }: { children: ReactNode }) {
  const content = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      setWidth(element.getBoundingClientRect().width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.span
      className='inline-block align-middle'
      initial={false}
      animate={{ width: width ?? 'auto' }}
      transition={{
        duration: reducedMotion ? 0 : 0.2,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <span ref={content} className='inline-flex w-max justify-center'>
        {children}
      </span>
    </motion.span>
  );
}
