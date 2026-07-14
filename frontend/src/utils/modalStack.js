import { useEffect } from 'react';

const modalStack = [];

export function pushModal(onClose) {
  modalStack.push(onClose);
}

export function popModal(onClose) {
  const index = modalStack.indexOf(onClose);
  if (index > -1) {
    modalStack.splice(index, 1);
  }
}

export function closeTopModal() {
  if (modalStack.length > 0) {
    const top = modalStack[modalStack.length - 1];
    top();
    return true;
  }
  return false;
}

export function useHardwareBack(isOpen, onClose) {
  useEffect(() => {
    if (isOpen && onClose) {
      pushModal(onClose);
      return () => popModal(onClose);
    }
  }, [isOpen, onClose]);
}
