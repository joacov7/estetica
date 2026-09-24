import QRCode from "qrcode";
import { getCurrentOrg } from "@/features/org/current";
import { publicUrl } from "@/lib/site-url";
import { QrPoster } from "@/features/qr/qr-poster";

export const dynamic = "force-dynamic";

async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#1f1f23", light: "#ffffff" },
  });
}

export default async function QrPage() {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const bookingUrl = publicUrl(`/${org.slug}`);
  const reviewsUrl = publicUrl(`/${org.slug}/opiniones`);
  const [bookingSvg, reviewsSvg] = await Promise.all([qrSvg(bookingUrl), qrSvg(reviewsUrl)]);
  const ig = org.instagram ? `@${org.instagram.replace(/^@/, "")}` : undefined;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Códigos QR</h1>
        <p className="text-muted-foreground">
          Imprimí estos carteles y pegalos en el local. Las clientas escanean con la cámara y
          reservan o dejan su opinión sin tener que buscar el link.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <QrPoster
          brand={org.name}
          title="Reservá tu turno"
          subtitle="Escaneá el código y elegí día, horario y servicio en segundos."
          svg={bookingSvg}
          url={bookingUrl}
          footer={ig}
        />
        <QrPoster
          brand={org.name}
          title="Dejanos tu opinión"
          subtitle="¿Cómo la pasaste? Contanos y ayudá a que más personas nos conozcan."
          svg={reviewsSvg}
          url={reviewsUrl}
          footer={ig}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Tip: si todavía no conectaste tu dominio propio, el QR usa el link actual de tu página. Cuando
        conectes el dominio definitivo, volvé a imprimir para que apunte ahí.
      </p>
    </div>
  );
}
