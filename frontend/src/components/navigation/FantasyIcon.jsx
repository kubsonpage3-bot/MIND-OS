import React from "react";

/**
 * FantasyIcon - Консистентный стиль для всех иконок в приложении
 * Использует strokeWidth={2.5} для более "графичного" вида
 * и добавляет легкую тень для атмосферы темного фэнтези
 */
export default function FantasyIcon({ children, size = 20, className = "", style = {}, ...props }) {
  return (
    <span 
      className={`fantasy-icon ${className}`}
      style={{ 
        width: size, 
        height: size, 
        ...style 
      }}
      {...props}
    >
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            size,
            strokeWidth: child.props.strokeWidth || 2.5,
            ...child.props,
          });
        }
        return child;
      })}
    </span>
  );
}