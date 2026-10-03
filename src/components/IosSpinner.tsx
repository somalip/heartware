import React from 'react';

interface IosSpinnerProps {
  size?: number;
  color?: string;
  className?: string;
}

export const IosSpinner: React.FC<IosSpinnerProps> = ({
  size = 20,
  color = 'currentColor',
  className = '',
}) => {
  const blades = [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div
      className={`ios-spinner ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        color,
      }}
      role="progressbar"
      aria-label="Loading"
    >
      {blades.map((i) => (
        <div
          key={i}
          className="ios-spinner-blade"
          style={{
            transform: `rotate(${i * 45}deg) translate(0, -140%)`,
            animationDelay: `${-0.875 + i * 0.125}s`,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  );
};
