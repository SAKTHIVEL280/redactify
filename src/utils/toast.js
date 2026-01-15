import toast from 'react-hot-toast';

/**
 * Show success toast notification
 */
export const showSuccess = (message) => {
  toast.success(message, {
    duration: 3000,
    style: {
      background: '#18181b',
      color: '#fff',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
  });
};

/**
 * Show error toast notification
 */
export const showError = (message) => {
  toast.error(message, {
    duration: 4000,
    style: {
      background: '#18181b',
      color: '#fff',
      border: '1px solid rgba(239, 68, 68, 0.5)',
    },
  });
};

/**
 * Show info toast notification
 */
export const showInfo = (message) => {
  toast(message, {
    duration: 3000,
    icon: 'ℹ️',
    style: {
      background: '#18181b',
      color: '#fff',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
  });
};

/**
 * Show warning toast notification
 */
export const showWarning = (message) => {
  toast(message, {
    duration: 4000,
    icon: '⚠️',
    style: {
      background: '#18181b',
      color: '#fff',
      border: '1px solid rgba(234, 179, 8, 0.5)',
    },
  });
};

/**
 * Show loading toast notification
 */
export const showLoading = (message) => {
  return toast.loading(message, {
    style: {
      background: '#18181b',
      color: '#fff',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
  });
};

/**
 * Dismiss a toast
 */
export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};
