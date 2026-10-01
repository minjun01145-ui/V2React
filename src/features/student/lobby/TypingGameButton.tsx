import Button from "../../../shared/ui/Button.tsx";
import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly mode?: "sentence" | "acid-rain";
}

export default function TypingGameButton({ disabled = false, mode = "acid-rain", ...props }: Props) {
  return (
    <Button variant="ghost" disabled={disabled} {...props}>
      {mode === "sentence" ? "문장 타자" : "산성비"}
    </Button>
  );
}
