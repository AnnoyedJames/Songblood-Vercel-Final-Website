"use client"

import type React from "react"

import { createContext, useContext } from "react"

type Toast = {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
  duration?: number
  variant?: "default" | "destructive" | "success" | "warning"
}

type ToastAction = {
  dismiss: (toastId?: string) => void
  toast: (props: Toast) => { id: string }
}

const ToastContext = createContext<ToastAction>({
  dismiss: () => {},
  toast: () => ({ id: "" }),
})

const useToast = () => {
  return useContext(ToastContext)
}

// Create a toast function that can be imported directly
// This is a workaround for components that can't use hooks
let toastFn: (props: Toast) => { id: string } = () => ({ id: "" })
let dismissFn: (toastId?: string) => void = () => {}

// This will be called by the ToastProvider to set the actual functions
export const setToastFunctions = (
  toastFunction: (props: Toast) => { id: string },
  dismissFunction: (toastId?: string) => void,
) => {
  toastFn = toastFunction
  dismissFn = dismissFunction
}

// Export the standalone toast function
export const toast = (props: Toast) => toastFn(props)
export const dismiss = (toastId?: string) => dismissFn(toastId)

export { ToastContext, useToast }
