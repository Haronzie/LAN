import React, { useEffect, useRef } from 'react';

const FocusableInput = ({ id, type = 'text', placeholder = '', value, onChange }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus(); // Automatically focus the input on mount
    }
  }, []);

  return (
    <input
      type={type}
      id={id}
      placeholder={placeholder}
      ref={inputRef}
      value={value}
      onChange={onChange}
      style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
    />
  );
};

export default FocusableInput;
