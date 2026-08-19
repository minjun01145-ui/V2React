import type { ComponentPropsWithoutRef } from "react";
import styles from "./Card.module.css";

type SectionProps = { readonly as?: "section" } & ComponentPropsWithoutRef<"section">;
type DivProps = { readonly as: "div" } & ComponentPropsWithoutRef<"div">;
type FormProps = { readonly as: "form" } & ComponentPropsWithoutRef<"form">;
type CardProps = SectionProps | DivProps | FormProps;

export default function Card(props: CardProps) {
  const { className = "" } = props;
  const classes = [styles.card, className].filter(Boolean).join(" ");
  if (props.as === "form") {
    const { as: _as, ...formProps } = props;
    return <form className={classes} {...formProps} />;
  }
  if (props.as === "div") {
    const { as: _as, ...divProps } = props;
    return <div className={classes} {...divProps} />;
  }
  const { as: _as, ...sectionProps } = props;
  return <section className={classes} {...sectionProps} />;
}
