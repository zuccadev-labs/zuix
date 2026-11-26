import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { Card } from "../content/Card";

export interface PaymentCardLabels {
  /** Nombre de la tarjeta para lectores: «Card ending in {last4}». */
  card: string;
  holder: string;
  expires: string;
}

export interface PaymentCardProps extends HTMLAttributes<HTMLElement> {
  /** Últimas cuatro cifras: el resto del número no se pinta nunca. */
  last4: string;
  holder?: string;
  /** Caducidad («08/29»). */
  expires?: string;
  /** Emisor o producto, arriba a la izquierda. */
  issuer?: ReactNode;
  /** Logotipo de la red (lo aporta la aplicación). */
  network?: ReactNode;
  /** Pago sin contacto: el símbolo junto al chip. */
  contactless?: boolean;
  /** Tono del metal. */
  tone?: "accent" | "info" | "success" | "warning" | "danger";
  labels?: Partial<PaymentCardLabels>;
}

const LABELS: PaymentCardLabels = { card: "Card ending in {last4}", holder: "Card holder", expires: "Expires" };

/** Tarjeta bancaria de metal con grano, chip y número oculto salvo las cuatro últimas cifras. */
export function PaymentCard({
  last4,
  holder,
  expires,
  issuer,
  network,
  contactless = true,
  tone = "accent",
  labels: labelsProp,
  className,
  ...rest
}: PaymentCardProps) {
  const labels = { ...LABELS, ...labelsProp };
  const digits = last4.replace(/\D/g, "").slice(-4);
  return (
    <Card
      {...rest}
      as="article"
      surface="metal"
      tone={tone}
      grain
      padding="lg"
      className={cx("z-payment-card", className)}
      aria-label={labels.card.replace("{last4}", digits)}
    >
      <div className="z-payment-card__top">
        <span className="z-payment-card__issuer">{issuer}</span>
        {contactless ? (
          <span className="z-payment-card__contactless" aria-hidden="true">
            <Icon name="wifi" size={20} />
          </span>
        ) : null}
      </div>
      <span className="z-payment-card__chip" aria-hidden="true" />
      <p className="z-payment-card__number">
        <span aria-hidden="true">•••• •••• •••• </span>
        <span className="z-sr-only">{labels.card.replace("{last4}", "")}</span>
        {digits}
      </p>
      <div className="z-payment-card__bottom">
        {holder ? (
          <span className="z-payment-card__field">
            <span className="z-payment-card__caption">{labels.holder}</span>
            {holder}
          </span>
        ) : null}
        {expires ? (
          <span className="z-payment-card__field">
            <span className="z-payment-card__caption">{labels.expires}</span>
            {expires}
          </span>
        ) : null}
        {network ? <span className="z-payment-card__network">{network}</span> : null}
      </div>
    </Card>
  );
}
