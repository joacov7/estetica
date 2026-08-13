import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Estética · Turnos online",
  description:
    "Sistema de gestión de turnos para estudios de manicura, pestañas, cejas y centros de estética.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans">{children}</body>
    </html>
  );
}
