import React, { ReactNode, useState, useRef, useEffect } from 'react';
import { triggerHaptic } from '../utils/haptics';

interface IosSheetProps {
  title: string;
  leftActionText?: string;
  onLeftAction: () => void;
  rightActionText?: string;
  onRightAction?: () => void;
  rightActionPrimary?: boolean;
  rightActionDisabled?: boolean;
  children: ReactNode;
  onClose: () => void;
}

export function IosSheet({
  title,
  leftActionText = 'Cancel',
  onLeftAction,
  rightActionText,
  onRightAction,
  rightActionPrimary = true,
  rightActionDisabled = false,
  children,
  onClose,
}: IosSheetProps) {
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    triggerHaptic('light');
    // Lock body scrolling while sheet is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleDismiss = () => {
    setIsClosing(true);
    triggerHaptic('light');
    setTimeout(() => {
      onClose();
    }, 280);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const sheet = sheetRef.current;
    if (sheet && sheet.scrollTop > 5) {
      // If user is scrolled down into sheet content, don't drag-dismiss unless at the top
      return;
    }
    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const clientY = e.touches[0].clientY;
    const delta = clientY - startYRef.current;
    if (delta > 0) {
      currentYRef.current = clientY;
      setTranslateY(delta);
    } else {
      // Upwards elastic resistance
      setTranslateY(delta * 0.2);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const delta = currentYRef.current - startYRef.current;
    if (delta > 90) {
      handleDismiss();
    } else {
      setTranslateY(0);
    }
  };

  return (
    <div
      className={`ios-sheet-overlay ${isClosing ? 'closing' : ''}`}
      onClick={handleDismiss}
      style={{
        opacity: Math.max(0.1, 1 - translateY / 300),
      }}
    >
      <div
        ref={sheetRef}
        className={`ios-sheet ${isClosing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: translateY > 0 ? `translateY(${translateY}px)` : translateY < 0 ? `translateY(${translateY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Grabber Area supporting drag gestures */}
        <div
          className="ios-sheet-drag-area"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="ios-sheet-grabber" />
          <div className="ios-sheet-header">
            <button
              type="button"
              className="ios-nav-action"
              onClick={() => {
                triggerHaptic('light');
                onLeftAction();
              }}
            >
              {leftActionText}
            </button>
            <div className="ios-sheet-title">{title}</div>
            {rightActionText && onRightAction ? (
              <button
                type="button"
                className={`ios-nav-action ${rightActionPrimary ? 'primary' : ''}`}
                disabled={rightActionDisabled}
                onClick={() => {
                  triggerHaptic('medium');
                  onRightAction();
                }}
              >
                {rightActionText}
              </button>
            ) : (
              <div style={{ width: '48px' }} />
            )}
          </div>
        </div>

        {/* Sheet Content */}
        <div className="ios-sheet-content">
          {children}
        </div>
      </div>
    </div>
  );
}
