import Phaser from "phaser";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { resizeScaleConfig } from "../../../game-engine/phaser-kit/scaleConfig.ts";
import { SkatingScene, type SkatingSceneSource } from "./SkatingScene.ts";
import styles from "../Skating.module.css";

/** Hosts the Phaser rink; the scene pulls fresh props every frame. */
const SkatingStage = forwardRef<HTMLDivElement, SkatingSceneSource>(function SkatingStage(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  useImperativeHandle(ref, () => host.current!, []);

  useEffect(() => {
    if (!host.current) return undefined;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      backgroundColor: "#eef8ff",
      scale: resizeScaleConfig(),
      scene: new SkatingScene(() => latest.current),
      input: { keyboard: false },
      audio: { noAudio: true },
      banner: false,
    });
    return () => game.destroy(true);
  }, []);

  return <div ref={host} className={styles.track} role="img" aria-label="세 갈래 아이스링크를 달리는 스케이팅 게임" />;
});

export default SkatingStage;
