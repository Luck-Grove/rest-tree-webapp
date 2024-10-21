import React from 'react';

const Button = ({ onClick, children, className, disabled }) => {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded ${
        disabled
          ? 'bg-gray-400 cursor-not-allowed'
          : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
      } text-white ${className}`}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;
