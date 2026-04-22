import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string | number;
  label: string;
}

interface CustomSelectProps {
  name?: string;
  value: string | number;
  onChange: (e: { target: { name: string; value: string | number } }) => void;
  options: Option[];
  disabled?: boolean;
  required?: boolean;
  style?: React.CSSProperties;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ name, value, onChange, options, disabled, required, style }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : value;

  const handleSelect = (optValue: string | number) => {
    if (disabled) return;
    onChange({ target: { name: name || '', value: optValue } });
    setIsOpen(false);
  };

  return (
    <div className="custom-select" ref={ref} style={{ position: 'relative', zIndex: isOpen ? 1000 : 1, ...style }}>
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          width: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-primary)',
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.875rem',
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'border-color 0.2s',
          opacity: disabled ? 0.6 : 1,
          textAlign: 'left',
          boxSizing: 'border-box',
        }}
      >
        <span>{displayLabel}</span>
        <ChevronDown size={14} style={{ 
          color: 'var(--text-muted)', 
          transition: 'transform 0.2s',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
        }} />
      </button>

      {isOpen && (
        <div className="custom-select-menu" style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          zIndex: 200,
          background: 'rgba(22, 27, 34, 0.98)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className="custom-select-option"
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: opt.value === value ? 'var(--accent-primary)' : 'var(--text-primary)',
                backgroundColor: opt.value === value ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                transition: 'background-color 0.15s',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = opt.value === value ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = opt.value === value ? 'rgba(59, 130, 246, 0.1)' : 'transparent'}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
