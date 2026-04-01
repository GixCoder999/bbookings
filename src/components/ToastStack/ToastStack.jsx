import { useToast } from '../../context/useToast.js'

function ToastStack() {
  const { toasts, dismissToast } = useToast()

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.type}`} key={toast.id} role="status">
          <span>{toast.message}</span>
          <button
            className="toast-dismiss"
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dismissToast(toast.id)}
          >
            x
          </button>
        </div>
      ))}
    </div>
  )
}

export default ToastStack
