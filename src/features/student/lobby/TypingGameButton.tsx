import Button from "../../../shared/ui/Button.tsx";
import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {}

export default function TypingGameButton({ disabled = false, ...props }: Props) {
  return (
    <Button variant="ghost" disabled={disabled} {...props}>
      ⌨️ 기다리는 동안 타자 게임하기
    </Button>
  );
}
