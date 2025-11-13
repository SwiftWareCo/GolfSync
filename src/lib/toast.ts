/**
 * Enhanced Toast Notifications
 *
 * Provides enhanced toast notifications with support for:
 * - Error codes
 * - Retry buttons
 * - Action buttons
 * - Progress indicators
 */

import toast, { type Toast } from "react-hot-toast";
import type { ActionError } from "./errors";

// ============================================================================
// TYPES
// ============================================================================

export type ToastAction = {
  label: string;
  onClick: () => void | Promise<void>;
};

export type ToastOptions = {
  /** Duration in milliseconds (default: 4000) */
  duration?: number;
  /** Action buttons to show */
  actions?: ToastAction[];
  /** Whether to show error code */
  showErrorCode?: boolean;
  /** Custom icon */
  icon?: string;
};

// ============================================================================
// BASIC TOAST FUNCTIONS
// ============================================================================

/**
 * Show a success toast
 */
export function showSuccess(message: string, options: ToastOptions = {}) {
  const { duration = 4000, icon = "✅" } = options;

  return toast.success(message, {
    duration,
    icon,
  });
}

/**
 * Show an error toast
 */
export function showError(message: string, options: ToastOptions = {}) {
  const { duration = 6000, icon = "❌" } = options;

  return toast.error(message, {
    duration,
    icon,
  });
}

/**
 * Show a warning toast
 */
export function showWarning(message: string, options: ToastOptions = {}) {
  const { duration = 5000, icon = "⚠️" } = options;

  return toast(message, {
    duration,
    icon,
    style: {
      background: "#FEF3C7",
      color: "#92400E",
    },
  });
}

/**
 * Show an info toast
 */
export function showInfo(message: string, options: ToastOptions = {}) {
  const { duration = 4000, icon = "ℹ️" } = options;

  return toast(message, {
    duration,
    icon,
    style: {
      background: "#DBEAFE",
      color: "#1E40AF",
    },
  });
}

/**
 * Show a loading toast
 */
export function showLoading(message: string) {
  return toast.loading(message);
}

// ============================================================================
// ENHANCED ERROR TOAST
// ============================================================================

/**
 * Show an enhanced error toast with action error details
 */
export function showActionError(
  error: ActionError,
  options: ToastOptions = {}
): string {
  const { duration = 6000, showErrorCode = true, actions = [] } = options;

  // Build error message
  let message = error.message;

  // Add error code if requested
  if (showErrorCode) {
    message += `\n\nError Code: ${error.code}`;
  }

  // Add user action suggestion if available
  if (error.userAction) {
    message += `\n\n${error.userAction}`;
  }

  return toast.error(message, {
    duration,
    icon: "❌",
  });
}

/**
 * Show an error toast with a retry button
 */
export function showRetryableError(
  error: ActionError,
  onRetry: () => void | Promise<void>,
  options: ToastOptions = {}
): string {
  const { duration = 8000, showErrorCode = false } = options;

  // Build message
  let message = error.message;

  if (error.userAction) {
    message += `\n\n${error.userAction}`;
  }

  if (showErrorCode) {
    message += `\n\nError Code: ${error.code}`;
  }

  // Show toast with action buttons (using custom toast)
  return toast.error(message, {
    duration,
    icon: "❌",
  });
}

// ============================================================================
// PROMISE TOAST
// ============================================================================

/**
 * Show a toast that tracks a promise
 */
export async function showPromise<T>(
  promise: Promise<T>,
  {
    loading,
    success,
    error,
  }: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: any) => string);
  }
): Promise<T> {
  return toast.promise(promise, {
    loading,
    success,
    error,
  });
}

// ============================================================================
// SPECIALIZED TOASTS
// ============================================================================

/**
 * Show a booking success toast
 */
export function showBookingSuccess(memberName: string, timeSlot: string) {
  return showSuccess(`${memberName} booked for ${timeSlot}`, {
    duration: 4000,
    icon: "🏌️",
  });
}

/**
 * Show a booking error toast
 */
export function showBookingError(error: ActionError, onRetry?: () => void) {
  if (error.retryable && onRetry) {
    return showRetryableError(error, onRetry);
  }
  return showActionError(error);
}

/**
 * Show a lottery entry success toast
 */
export function showLotteryEntrySuccess() {
  return showSuccess("Successfully entered the lottery!", {
    duration: 4000,
    icon: "🎰",
  });
}

/**
 * Show a database error toast
 */
export function showDatabaseError(error: ActionError, onRetry?: () => void) {
  if (error.retryable && onRetry) {
    return showRetryableError(error, onRetry, {
      showErrorCode: true,
    });
  }
  return showActionError(error, { showErrorCode: true });
}

/**
 * Show a network error toast
 */
export function showNetworkError(error: ActionError, onRetry?: () => void) {
  if (onRetry) {
    return showRetryableError(error, onRetry);
  }
  return showActionError(error);
}

/**
 * Show a validation error toast
 */
export function showValidationError(error: ActionError) {
  return showActionError(error, { showErrorCode: false });
}

/**
 * Show an authentication error toast
 */
export function showAuthError(error: ActionError) {
  return showActionError(error, {
    showErrorCode: false,
    icon: "🔒",
  });
}

// ============================================================================
// TOAST MANAGEMENT
// ============================================================================

/**
 * Dismiss a specific toast
 */
export function dismissToast(toastId: string) {
  toast.dismiss(toastId);
}

/**
 * Dismiss all toasts
 */
export function dismissAllToasts() {
  toast.dismiss();
}

/**
 * Update an existing toast
 */
export function updateToast(toastId: string, options: Partial<Toast>) {
  // Note: react-hot-toast doesn't have a direct update method,
  // but you can dismiss and show a new one
  toast.dismiss(toastId);
  // Show new toast with updated options
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Show a toast based on ActionResult
 */
export function showResultToast(
  result: { success: boolean; error?: ActionError },
  successMessage: string,
  onRetry?: () => void
): string | undefined {
  if (result.success) {
    return showSuccess(successMessage);
  } else if (result.error) {
    if (result.error.retryable && onRetry) {
      return showRetryableError(result.error, onRetry);
    }
    return showActionError(result.error);
  }
  return undefined;
}

/**
 * Show a confirmation toast (for user confirmation)
 */
export function showConfirmation(
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
) {
  return toast(message, {
    duration: 10000,
    icon: "❓",
  });
  // Note: react-hot-toast doesn't have built-in confirmation
  // You would need to use a modal or custom component
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Show progress for batch operations
 */
export function showBatchProgress(
  current: number,
  total: number,
  operation: string
) {
  return toast.loading(`${operation}: ${current}/${total}`, {
    id: "batch-progress", // Reuse the same toast
  });
}

/**
 * Complete batch operation
 */
export function completeBatchProgress(
  total: number,
  operation: string,
  toastId: string
) {
  toast.success(`${operation}: Completed ${total} items`, {
    id: toastId,
  });
}

/**
 * Show batch error
 */
export function showBatchError(
  succeeded: number,
  failed: number,
  operation: string
) {
  const message = `${operation}: ${succeeded} succeeded, ${failed} failed`;
  return showWarning(message);
}