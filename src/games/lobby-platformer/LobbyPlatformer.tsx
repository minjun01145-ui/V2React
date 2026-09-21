import Phaser from "phaser";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { movementAction } from "../../game-engine/input/movementKeys.ts";
import { createLiveMovementEngine } from "../../live-world/client.ts";
import { displayLabel, type Player } from "../../multiplayer/types.ts";
import Button from "../../shared/ui/Button.tsx";
import { clearPlatformerInput, createPlatformerInput } from "./movement.ts";
import PlatformerScene from "./PlatformerScene.ts";
import { GRAVITY, SPAWN, VIEW_HEIGHT, VIEW_WIDTH } from "./level.ts";
import styles from "./LobbyPlatformer.module.css";

const LOBBY_SCOPE_ID = "lobby";
const PLATFORMER_CHANNEL_ID = "platformer-test";

interface Props {
  readonly roomId: string;
  readonly playerId: string;
  readonly label: string;
  readonly players: readonly Player[];
  readonly onExit: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest("input, textarea, select, button, [contenteditable='true']"));
}

export default function LobbyPlatformer({ roomId, playerId, label, players, onExit }: Props) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef(createPlatformerInput());
  const labelsRef = useRef(new Map<string, string>());
  const [connectionError, setConnectionError] = useState<Error | null>(null);

  labelsRef.current = new Map(players.map((player) => [
    player.id,
    displayLabel(player.displayName, player.nickname),
  ]));

  useEffect(() => {
    shellRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return;
      if (event.code === "KeyR") {
        event.preventDefault();
        if (!event.repeat) input.resetQueued = true;
        return;
      }
      const action = movementAction(event.code, event.key);
      if (!action) return;
      event.preventDefault();
      if (action === "jump") {
        if (!event.repeat) input.jumpQueued = true;
        return;
      }
      input.held.set(event.code || event.key, action);
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      input.held.delete(event.code || event.key);
    };
    const clear = (): void => clearPlatformerInput(input);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      clear();
    };
  }, []);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return undefined;
    setConnectionError(null);
    let active = true;
    const onError = (error: Error): void => { if (active) setConnectionError(error); };

    const live = createLiveMovementEngine(playerId, {
      sendHz: 10,
      onError,
    });
    const scene = new PlatformerScene({
      input: inputRef.current,
      label,
      publish: (state) => live.updateLocal(state),
      samplePlayers: () => live.sampleRemotePlayers(),
      playerLabel: (id) => labelsRef.current.get(id),
    });
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: host.clientHeight > 0 ? Math.round(VIEW_HEIGHT * host.clientWidth / host.clientHeight) : VIEW_WIDTH,
      height: VIEW_HEIGHT,
      backgroundColor: "#dff5fa",
      physics: {
        default: "arcade",
        arcade: { gravity: { x: 0, y: GRAVITY }, debug: false },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: { antialias: true, pixelArt: false },
      input: { keyboard: false },
      audio: { noAudio: true },
      scene,
    });
    const resize = new ResizeObserver(() => {
      if (game.isBooted && host.clientHeight > 0) {
        game.scale.resize(Math.round(VIEW_HEIGHT * host.clientWidth / host.clientHeight), VIEW_HEIGHT);
      }
    });
    resize.observe(host);

    void live.connect(
      { roomId, roundId: LOBBY_SCOPE_ID, channelId: PLATFORMER_CHANNEL_ID },
      { x: SPAWN.x, y: SPAWN.y, vx: 0, vy: 0 },
    ).catch((reason: unknown) => {
      onError(reason instanceof Error ? reason : new Error("실시간 이동 연결에 실패했습니다."));
    });

    return () => {
      active = false;
      resize.disconnect();
      clearPlatformerInput(inputRef.current);
      game.destroy(true);
      void live.close();
    };
  }, [label, playerId, roomId]);

  const press = (event: PointerEvent<HTMLButtonElement>, action: "left" | "right" | "jump"): void => {
    event.preventDefault();
    shellRef.current?.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (action === "jump") inputRef.current.jumpQueued = true;
    else inputRef.current.held.set(`pointer-${event.pointerId}`, action);
  };
  const release = (event: PointerEvent<HTMLButtonElement>): void => {
    inputRef.current.held.delete(`pointer-${event.pointerId}`);
  };

  return <div
    ref={shellRef}
    className={styles.shell}
    tabIndex={0}
    aria-label="대기실 플랫포머 조작 영역"
    onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) clearPlatformerInput(inputRef.current);
    }}
  >
    <header className={styles.header}>
      <div>
        <strong>대기실 플랫포머 (테스트)</strong>
        <span>← → / A D 이동 · ↑ / W / Space 점프 · 공중에서 한 번 더 점프 · R 리셋</span>
      </div>
      <Button variant="ghost" onClick={onExit}>대기실로</Button>
    </header>
    {connectionError ? <div className={styles.error}>실시간 연결 오류: {connectionError.message}</div> : null}
    <div ref={canvasHostRef} className={styles.canvasHost} onPointerDown={() => shellRef.current?.focus({ preventScroll: true })} />
    <div className={styles.controls} aria-label="플랫포머 조작">
      {(["left", "right", "jump"] as const).map((action) => <button
        key={action} type="button"
        aria-label={action === "left" ? "왼쪽 이동" : action === "right" ? "오른쪽 이동" : "점프"}
        onPointerDown={(event) => press(event, action)}
        onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
        onKeyDown={(event) => {
          if (event.key !== " " && event.key !== "Enter") return;
          event.preventDefault();
          if (action === "jump") { if (!event.repeat) inputRef.current.jumpQueued = true; }
          else inputRef.current.held.set("button", action);
        }}
        onKeyUp={() => inputRef.current.held.delete("button")}
        onBlur={() => inputRef.current.held.delete("button")}
      >{action === "left" ? "←" : action === "right" ? "→" : "점프 ↑"}</button>)}
      <Button variant="ghost" onClick={() => {
        inputRef.current.resetQueued = true;
        shellRef.current?.focus({ preventScroll: true });
      }}>처음으로</Button>
    </div>
    <small className={styles.hint}>같은 방에서 이 게임에 들어온 친구의 이름과 위치가 함께 보여요. 떨어지면 출발점으로 돌아와요.</small>
  </div>;
}
