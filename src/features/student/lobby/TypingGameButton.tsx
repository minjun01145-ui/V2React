import Button from "../../../shared/ui/Button.tsx";
import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {}

/**
 * 대기 중 타자 게임 진입 버튼. 타자 게임 구축 전까지 비활성화한다.
 * 게임 완성 후에는 disabled prop을 제거하고 onClick 핸들러만 연결하면 된다.
 */
export default function TypingGameButton({ disabled = true, ...props }: Props) {
  return (
    <Button variant="ghost" disabled={disabled} {...props}>
      ⌨️ 기다리는 동안 타자 게임하기
    </Button>
  );
}