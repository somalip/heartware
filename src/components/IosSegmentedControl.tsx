import { useRef, useEffect, useState } from 'react';
import { triggerHaptic } from '../utils/haptics';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface IosSegmentedControlProps<T extends string> {
  options: readonly Option<T>[] | Option<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
}

export function IosSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: IosSegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 2,
    width: 0,
  });

  const activeIndex = options.findIndex((opt) => opt.value === value);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const buttons = container.querySelectorAll<HTMLButtonElement>('.ios-seg-btn');
    if (buttons[activeIndex]) {
      const btn = buttons[activeIndex];
      setIndicatorStyle({
        left: btn.offsetLeft,
        width: btn.offsetWidth,
      });
    }
  }, [activeIndex, options]);

  const handleSelect = (val: T) => {
    if (val !== value) {
      triggerHaptic('selection');
      onChange(val);
    }
  };

  return (
    <div className={`ios-segmented-wrapper ${className}`} ref={containerRef} role="tablist">
      <div
        className="ios-segmented-indicator"
        style={{
          transform: `translateX(${indicatorStyle.left}px)`,
          width: `${indicatorStyle.width}px`,
        }}
      />
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`ios-seg-btn ${isActive ? 'active' : ''}`}
            onClick={() => handleSelect(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
