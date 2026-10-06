"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({ children, pendingLabel }: { children: React.ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
