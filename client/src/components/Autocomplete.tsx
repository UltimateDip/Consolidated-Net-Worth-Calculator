import React, { useState, useRef, useEffect } from 'react';

interface Suggestion {
  symbol: string;
  description: string;
}

interface AutocompleteProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelect: (suggestion: Suggestion) => void;
  suggestions: Suggestion[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
}

const Autocomplete: React.FC<AutocompleteProps> = ({ 
  value, 
  onChange, 
  onSelect, 
  suggestions, 
  placeholder, 
  disabled, 
  required,
  name 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show suggestions when they arrive and value isn't empty
  useEffect(() => {
    if (suggestions.length > 0 && value.length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [suggestions, value]);

  return (
    <div className="custom-autocomplete" ref={ref} style={{ position: 'relative', zIndex: isOpen ? 1000 : 1 }}>
      <input
        type="text"
        name={name}
        value={value}
        onChange={(e) => {
          onChange(e);
          if (e.target.value.length >= 2) setIsOpen(true);
        }}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete="off"
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
          boxSizing: 'border-box',
          transition: 'border-color 0.2s',
        }}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
      />

      {isOpen && suggestions.length > 0 && (
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
          maxHeight: '250px',
          overflowY: 'auto'
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onClick={() => {
                onSelect(s);
                setIsOpen(false);
              }}
              className="custom-select-option"
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{s.symbol}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Autocomplete;
