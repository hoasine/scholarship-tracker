import { toast as sonnerToast, ExternalToast } from "sonner";

/**
 * Custom toast utilities with brand styling consistent with Alert components
 * Colors and styling match the existing design system
 */

// Default toast options with brand styling
const defaultOptions: ExternalToast = {
  duration: 4000,
  closeButton: true,
};

// Success toast with accent colors (matching text-accent)
export const success = (message: string, options?: ExternalToast) => {
  return sonnerToast.success(message, {
    ...defaultOptions,
    duration: 4000,
    ...options,
  });
};

// Error toast with destructive colors (matching text-destructive)
export const error = (message: string, options?: ExternalToast) => {
  return sonnerToast.error(message, {
    ...defaultOptions,
    duration: 6000, // Longer for errors
    ...options,
  });
};

// Warning toast with yellow colors (matching text-yellow-400)
export const warning = (message: string, options?: ExternalToast) => {
  return sonnerToast.warning(message, {
    ...defaultOptions,
    duration: 5000,
    ...options,
  });
};

// Info toast with default colors
export const info = (message: string, options?: ExternalToast) => {
  return sonnerToast.info(message, {
    ...defaultOptions,
    duration: 3000,
    ...options,
  });
};

// Loading toast for async operations — no close button (avoids broken X layout mid-tx)
export const loading = (message: string, options?: ExternalToast) => {
  return sonnerToast.loading(message, {
    ...defaultOptions,
    closeButton: false,
    duration: Infinity, // Manual dismiss
    ...options,
  });
};

const TX_TOAST_ID = "scholarship-tx-status";

/** Long-lived loading toast updated as the tx progresses. */
export const txLoading = (message: string) => {
  return loading(message, { id: TX_TOAST_ID });
};

export const txLoadingUpdate = (message: string) => {
  return sonnerToast.loading(message, {
    ...defaultOptions,
    id: TX_TOAST_ID,
    closeButton: false,
    duration: Infinity,
  });
};

export const txSuccess = (message: string, options?: ExternalToast) => {
  return success(message, {
    id: TX_TOAST_ID,
    duration: 4500,
    ...options,
  });
};

export const txError = (message: string, options?: ExternalToast) => {
  return error(message, {
    id: TX_TOAST_ID,
    duration: 12000,
    ...options,
  });
};

// Promise toast for handling async operations
export const promise = <T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((result: T) => string);
    error: string | ((error: unknown) => string);
  },
  options?: ExternalToast
) => {
  return sonnerToast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
    ...defaultOptions,
    ...options,
  });
};

// Configuration error toast (persistent until dismissed)
export const configError = (message: string, description?: string, action?: { label: string; onClick: () => void }) => {
  return sonnerToast.error(message, {
    description,
    duration: Infinity,
    closeButton: true,
    action: action ? {
      label: action.label,
      onClick: action.onClick,
    } : undefined,
  });
};

// User rejection toast (brief, non-intrusive)
export const userRejected = (message: string) => {
  return sonnerToast.info(message, {
    duration: 2000,
    closeButton: false,
  });
};

// Export the original toast for custom usage
export { sonnerToast as toast };

export const toastHelpers = {
  success,
  error,
  warning,
  info,
  loading,
  txLoading,
  txLoadingUpdate,
  txSuccess,
  txError,
  promise,
  configError,
  userRejected,
  toast: sonnerToast,
};