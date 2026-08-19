import { Component, type ErrorInfo, type ReactNode } from "react";
import styles from "./GameErrorBoundary.module.css";

interface Props {
  readonly children: ReactNode;
  readonly resetKey: string;
}

interface State {
  readonly error: Error | null;
}

export default class GameErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Game module crashed", error, info);
  }

  override componentDidUpdate(prevProps: Props): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return <section className={styles.boundary} role="alert"><h2>게임 화면에서 오류가 발생했습니다.</h2><p>{this.state.error.message || "알 수 없는 오류"}</p></section>;
  }
}
