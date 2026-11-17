import { lazy, Suspense } from "react";
import { useDocumentVisible } from "../hooks/useDocumentVisible";
import type { ThemeDef } from "../lib/themes";

/* WebGL 背景按需加载：只有选中极光类主题时才下载对应 chunk */
const Aurora = lazy(() => import("./reactbits/Aurora"));

type Props = {
  theme: ThemeDef;
  reduced: boolean;
};

export default function ThemeScene({ theme, reduced }: Props) {
  const visible = useDocumentVisible();
  const paused = reduced || !visible;
  const { kind, colors, opacity } = theme.scene;

  if (kind === "none" || reduced) return null;

  if (kind === "grainient") {
    return (
      <div
        className="grainient-bg"
        aria-hidden="true"
        style={{
          opacity,
          backgroundImage: [
            `radial-gradient(90% 80% at 12% 8%, ${colors[0]} 0%, transparent 62%)`,
            `radial-gradient(80% 90% at 88% 12%, ${colors[1]} 0%, transparent 60%)`,
            `radial-gradient(90% 80% at 50% 96%, ${colors[2]} 0%, transparent 64%)`,
          ].join(", "),
        }}
      >
        <span className="grainient-noise" />
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <Aurora
        colorStops={colors}
        amplitude={0.8}
        speed={0.4}
        dpr={1}
        opacity={opacity}
        mouseInteraction={false}
        lightMode={theme.mode === "light"}
        paused={paused}
      />
    </Suspense>
  );
}
