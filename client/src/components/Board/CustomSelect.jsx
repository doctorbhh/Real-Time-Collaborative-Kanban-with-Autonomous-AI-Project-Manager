import React, { useState, useRef, useEffect } from 'react';

export default function CustomSelect({ value, onChange, options, placeholder = "Select...", disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="custom-select-container" ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        className={`input ${isOpen ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{ 
          width: '100%', 
          padding: '6px 8px', 
          fontSize: 13, 
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none',
          backgroundColor: 'var(--surface-container-lowest)',
          border: isOpen ? '1px solid var(--primary)' : '1px solid var(--outline-variant)',
          borderRadius: 'var(--radius)',
          opacity: disabled ? 0.6 : 1
        }}
      >
        <span style={{ color: selectedOption ? 'var(--on-surface)' : 'var(--on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
          {selectedOption && selectedOption.color && (
            <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: selectedOption.color }}></div>
          )}
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--outline)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          expand_more
        </span>
      </div>

      {isOpen && (
        <div className="custom-select-menu">
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              style={{
                padding: '8px 12px',
                fontSize: 13,
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: value === option.value ? 'var(--primary-fixed)' : 'transparent',
                color: value === option.value ? 'var(--primary)' : 'var(--on-surface)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background-color 0.1s'
              }}
              onMouseEnter={(e) => {
                if (value !== option.value) {
                  e.currentTarget.style.backgroundColor = 'var(--surface-container)';
                }
              }}
              onMouseLeave={(e) => {
                if (value !== option.value) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {option.color && (
                <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: option.color }}></div>
              )}
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
