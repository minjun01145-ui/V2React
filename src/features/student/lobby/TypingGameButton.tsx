import Button from "../../../shared/ui/Button.tsx";
import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly mode?: "sentence" | "acid-rain";
}

export default function TypingGameButton({ disabled = false, mode = "acid-rain", ...props }: Props) {
  return (
    <Button variant="ghost" disabled={disabled} {...props}>
      ⌨️ {mode === "sentence" ? "단문" : "산성비"} 타자게임 하기
    </Button>
  );
}
