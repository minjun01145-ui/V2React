import type { GameDefinition } from "../../../game-engine/contracts/gameDefinition.ts";
import CoverTile from "../../../shared/ui/CoverTile.tsx";
import { coverArt, isCoverKey } from "../../../shared/ui/coverArt.ts";
import styles from "./GamePicker.module.css";

interface Props {
  games: readonly GameDefinition[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled: boolean;
}

const GROUPS = [
  { title: "학습", games: [
    ["ai-tutor", "AI 문답"],
    ["simple-quiz", "객관식 퀴즈"],
    ["matching-all", "짝 맞추기(모든 카드)"],
    ["matching", "짝 맞추기(일부 카드)"],
    ["sentence-builder", "문장 만들기"],
  ] },
  { title: "타자", games: [["typing", "문장 타자"], ["acid-rain", "산성비"], ["typing-escape", "무궁화 탈출"]] },
  { title: "게임", games: [
    ["learning-jump-tower", "학습 점프타워"],
    ["one-on-one-battle", "1:1 배틀"],
    ["word-uno", "단어 우노"],
    ["cooperative-sentence-builder", "커플 문장 만들기"],
    ["pokemon-catch", "포켓몬 잡기"],
    ["meaning-dash", "달리기"],
    ["brick-smash", "벽돌 팡팡"],
    ["word-ninja", "단어 닌자"],
    ["chunk-line-up", "플랫포머 문장 만들기"],
    ["chunk-jump-race", "점프 문장 만들기"],
  ] },
] as const;

const groupedGameIds = new Set<string>(GROUPS.flatMap((group) => group.games.map(([id]) => id)));

export default function GamePicker({ games, selectedId, onSelect, disabled }: Props) {
  return <div className={styles.picker}>
    {GROUPS.map(({ title, games: entries }) => {
      const group: { game: GameDefinition; label: string }[] = entries.flatMap(([id, label]) => {
        const game = games.find((candidate) => candidate.id === id);
        return game ? [{ game, label }] : [];
      });
      // Grouping controls presentation; new playable games must remain selectable.
      if (title === "게임") {
        group.push(...games.filter((game) => !groupedGameIds.has(game.id))
          .map((game) => ({ game, label: game.title })));
      }
      if (group.length === 0) return null;
      return <section className={styles.group} key={title} aria-label={title}>
        <h3 className={styles.heading}>{title}</h3>
        <div className={styles.cards}>
          {group.map(({ game, label }) => <CoverTile key={game.id} title={label} art={isCoverKey(game.id) ? coverArt(game.id) : null} selected={selectedId === game.id} disabled={disabled} onClick={() => onSelect(game.id)} />)}
        </div>
      </section>;
    })}
  </div>;
}
