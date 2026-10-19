import Phaser from "phaser";
import { useEffect, useRef } from "react";
import { resizeScaleConfig } from "../../game-engine/phaser-kit/scaleConfig.ts";
import { RunControls } from "./scene/controls.ts";
import { GoldRunScene, type GoldRunSceneSource } from "./scene/GoldRunScene.ts";
import styles from "./GoldRun.module.css";

type Props = Omit<GoldRunSceneSource, "controls">;

/** Hosts the Phaser run; the scene reads the latest props every frame. */
export default function GoldRunStage(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<RunControls | null>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    if (!host.current) return undefined;
    controls.current = new RunControls(host.current);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      backgroundColor: "#27325e",
      scale: resizeScaleConfig(),
      scene: new GoldRunScene(() => ({ ...latest.current, controls: controls.current })),
      input: { keyboard: false },
      audio: { noAudio: true },
      banner: false,
    });
    return () => {
      game.destroy(true);
      controls.current?.destroy();
      controls.current = null;
    };
  }, []);

  return <div ref={host} className={styles.stage} role="img" aria-label="세 갈래 길을 달리며 O·X 문을 골라 통과하는 골드런" />;
}
