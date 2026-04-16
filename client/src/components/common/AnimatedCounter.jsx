import React, { useState, useEffect, useRef } from 'react';
import { formatCurrency } from '../../utils/formatters';

/**
 * A premium animated counter that interpolates between values
 * using requestAnimationFrame for smooth 60fps performance.
 */
const AnimatedCounter = ({ value, currency, duration = 800 }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [trend, setTrend] = useState(null); // 'up', 'down', or null
  const prevValueRef = useRef(value);
  const requestRef = useRef();
  const startTimeRef = useRef();

  useEffect(() => {
    // Detect if this is an actual change or initial load
    const startValue = prevValueRef.current;
    const endValue = value;

    if (startValue === endValue) return;

    // Determine direction for animation color
    const direction = endValue > startValue ? 'up' : 'down';
    setTrend(direction);
    
    // Clear trend after animation finishes
    const timer = setTimeout(() => setTrend(null), 1000);

    const animate = (time) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsedTime = time - startTimeRef.current;
      const progress = Math.min(elapsedTime / duration, 1);
      
      // Easing function: easeOutExpo
      const easing = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      const current = startValue + (endValue - startValue) * easing;
      
      setDisplayValue(current);

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = endValue;
        startTimeRef.current = null;
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(requestRef.current);
      clearTimeout(timer);
      startTimeRef.current = null;
    };
  }, [value, duration]);

  const getClassName = () => {
    if (trend === 'up') return 'flash-up';
    if (trend === 'down') return 'flash-down';
    return '';
  };

  return (
    <span className={getClassName()} style={{
      display: 'inline-block',
      transition: 'color 0.3s ease'
    }}>
      {formatCurrency(displayValue, currency)}
    </span>
  );
};

export default AnimatedCounter;
