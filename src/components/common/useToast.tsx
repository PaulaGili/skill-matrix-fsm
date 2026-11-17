"use client";

import { useState } from "react";
import { Toast } from "@ui5/webcomponents-react";

// A short confirmation message. Each message gets its own Toast element, so the closing
// animation of an earlier message cannot hide the next one.
export function useToast() {
  const [toast, setToast] = useState({ id: 0, message: "" });

  const showToast = (message: string) => setToast((current) => ({ id: current.id + 1, message }));
  const toastElement = toast.message ? (
    <Toast key={toast.id} open>
      {toast.message}
    </Toast>
  ) : null;

  return { toastElement, showToast };
}
