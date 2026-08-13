"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markReminderSent } from "./actions";

/** Opens WhatsApp with the pre-filled reminder and marks it as sent. */
export function ReminderButton({
  appointmentId,
  phone,
  message,
  sent,
}: {
  appointmentId: string;
  phone: string;
  message: string;
  sent: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const digits = phone.replace(/\D/g, "");
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => start(async () => { await markReminderSent(appointmentId); router.refresh(); })}
      className={cn(buttonVariants({ variant: sent ? "outline" : "gold", size: "sm" }))}
    >
      {sent ? <Check className="size-4" /> : <MessageCircle className="size-4" />}
      {sent ? "Reenviar" : "Recordar"}
    </a>
  );
}
