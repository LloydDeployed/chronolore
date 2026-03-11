import { useState, useEffect } from "react";

interface ToastMessage {
  id: number;
  text: string;
  type: "error" | "success";
}

let toastId = 0;
let addToastFn: ((msg: Omit<ToastMessage, "id">) => void) | null = null;

export function toast(text: string, type: "error" | "success" = "error") {
  addToastFn?.({ text, type });
}

export function ToastContainer() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    addToastFn = (msg) => {
      const id = ++toastId;
      setMessages((prev) => [...prev, { ...msg, id }]);
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }, 4000);
    };
    return () => {
      addToastFn = null;
    };
  }, []);

  if (messages.length === 0) return null;

  return (
    <div className="toast-container">
      {messages.map((m) => (
        <div key={m.id} className={`toast toast-${m.type}`}>
          {m.text}
        </div>
      ))}
    </div>
  );
}
