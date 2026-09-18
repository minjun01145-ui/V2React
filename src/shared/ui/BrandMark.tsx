import type { TenantConfig } from "../../tenant/config.ts";
import styles from "./BrandMark.module.css";

interface Props {
  readonly className?: string | undefined;
  readonly tenant: TenantConfig;
}

export default function BrandMark({ className = "", tenant }: Props) {
  const classes = [styles.mark, className].filter(Boolean).join(" ");
  return <img className={classes} src={tenant.logoSrc} alt={tenant.brandAlt} draggable="false" />;
}
