import React from 'react';
import PropTypes from 'prop-types';

const ClickableButton = ({ type, onClick, children, ariaLabel }) => {
  const handleClick = (e) => {
    console.log('Button was clicked!');
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button type={type} onClick={handleClick} aria-label={ariaLabel}>
      {children}
    </button>
  );
};

ClickableButton.propTypes = {
  type: PropTypes.string,
  onClick: PropTypes.func,
  children: PropTypes.node.isRequired,
  ariaLabel: PropTypes.string,
};

ClickableButton.defaultProps = {
  type: 'button',
  ariaLabel: 'Click Me',
  onClick: null,
};

export default ClickableButton;
