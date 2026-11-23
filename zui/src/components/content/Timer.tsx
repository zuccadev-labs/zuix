"use client";
import { useEffect, useRef, useState, type HTMLAttributes, type Ref } from "react";
import {
  elapsedOf,
  idleClock,
  isoDuration,
  milestone,
  nextTick,
  parseDuration,
  pauseClock,
  shownMs,
  spokenDuration,
  startClock,
  timerText,
  type TimerClock,
  type TimerMode,
  type TimerPrecision,
  type TimerState,
} from "../../core/stopwatch";
import { cx } from "../../cx";
import { Button } from "../actions/Button";
import { withRef } from "../../react-compat";

export interface TimerProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "onChange"> {
  /** Cuenta atrás (por defecto) o cronómetro. */
  mode?: TimerMode;
  /** Cuenta atrás: duración en segundos o ISO 8601 (`PT5M`). */
  duration?: number | string;
  /** Empieza a correr al montar. */
  autoStart?: boolean;
  /** Décimas de segundo en la pantalla. */
  precision?: TimerPrecision;
  /** Siempre con horas (`0:04:30`). Por defecto, solo desde una hora. */
  showHours?: boolean;
  /** Botones Iniciar/Pausar/Reanudar y Reiniciar. */
  controls?: boolean;
  /** Anuncia cada N segundos en la región viva (0: solo inicio, pausa y fin). Por defecto 60. */
  announceEvery?: number;
  /** Cuenta atrás: anuncia cada uno de los últimos N segundos. Por defecto 0. */
  announceFinal?: number;
  /** Etiqueta BCP 47 para cifras y texto hablado. */
  locale?: string;
  orientation?: "horizontal" | "vertical";
  /** Nombre accesible del grupo. */
  label?: string;
  startLabel?: string;
  pauseLabel?: string;
  resumeLabel?: string;
  resetLabel?: string;
  /** Lo que anuncia la región viva al terminar. */
  doneLabel?: string;
  /** Prefijos de los anuncios: «Paused, 4 minutes left». */
  pausedLabel?: string;
  leftLabel?: string;
  onStateChange?: (state: TimerState) => void;
  onComplete?: () => void;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Cuenta atrás o cronómetro con pausa y reinicio. La pantalla es `role="timer"` (sin región viva: el lector la lee
 * al llegar a ella, con el tiempo hablado como nombre); los cambios de estado y los hitos van a una región `status`
 * aparte, para no anunciar cada segundo.
 */
export const Timer = withRef(function Timer({
  mode = "countdown",
  duration,
  autoStart = false,
  precision = "second",
  showHours,
  controls = true,
  announceEvery = 60,
  announceFinal = 0,
  locale,
  orientation = "horizontal",
  label = "Timer",
  startLabel = "Start",
  pauseLabel = "Pause",
  resumeLabel = "Resume",
  resetLabel = "Reset",
  doneLabel = "Time's up",
  pausedLabel = "Paused",
  leftLabel = "left",
  onStateChange,
  onComplete,
  className,
  ref,
  ...rest
}: TimerProps) {
  const total = mode === "countdown" ? parseDuration(duration) : 0;
  const [clock, setClock] = useState<TimerClock>(idleClock);
  const [state, setStateRaw] = useState<TimerState>("idle");
  const [now, setNow] = useState(0);
  const [message, setMessage] = useState("");
  const shownRef = useRef(mode === "countdown" ? total : 0);
  const callbacks = useRef({ onStateChange, onComplete });
  callbacks.current = { onStateChange, onComplete };

  const setState = (next: TimerState) => {
    setStateRaw(next);
    callbacks.current.onStateChange?.(next);
  };
  const elapsed = state === "running" ? elapsedOf(clock, now) : clock.accumulated;
  const shown = shownMs(mode, total, elapsed);
  const spoken = (ms: number) =>
    mode === "countdown" ? `${spokenDuration(ms, locale, mode)} ${leftLabel}` : spokenDuration(ms, locale, mode);
  // Vaciar antes de escribir: el mismo texto dos veces seguidas también se anuncia.
  const announce = (text: string) => {
    setMessage("");
    requestAnimationFrame(() => setMessage(text));
  };

  const start = () => {
    if (mode === "countdown" && !total) return;
    const at = Date.now();
    const base = state === "done" ? idleClock() : clock;
    setClock(startClock(base, at));
    setNow(at);
    setState("running");
    announce(spoken(shownMs(mode, total, base.accumulated)));
  };
  const pause = () => {
    const at = Date.now();
    const next = pauseClock(clock, at);
    setClock(next);
    setState("paused");
    announce(`${pausedLabel}, ${spoken(shownMs(mode, total, next.accumulated))}`);
  };
  const reset = () => {
    setClock(idleClock());
    setState("idle");
    shownRef.current = mode === "countdown" ? total : 0;
    setMessage("");
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: solo al montar.
  useEffect(() => {
    if (autoStart) start();
  }, []);

  // Un temporizador por repintado, alineado al cambio de lo que se muestra.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `now` reprograma el siguiente repintado.
  useEffect(() => {
    if (state !== "running") return;
    const before = shownRef.current;
    shownRef.current = shown;
    if (mode === "countdown" && shown === 0) {
      setClock((c) => ({ accumulated: Math.max(total, elapsedOf(c, Date.now())), startedAt: null }));
      setState("done");
      announce(doneLabel);
      callbacks.current.onComplete?.();
      return;
    }
    const hit = milestone(mode, before, shown, announceEvery, announceFinal);
    if (hit !== null) announce(spoken(shown));
    const id = setTimeout(() => setNow(Date.now()), Math.max(16, nextTick(mode, total, elapsed, precision)));
    return () => clearTimeout(id);
  }, [state, now]);

  const text = timerText(shown, { mode, precision, hours: showHours, locale });
  const running = state === "running";
  return (
    <div
      {...rest}
      ref={ref}
      role="group"
      aria-label={label}
      className={cx("z-timer", className)}
      data-mode={mode}
      data-state={state}
      data-orientation={orientation}
    >
      <time className="z-timer__display" dateTime={isoDuration(shown)}>
        <span role="timer" aria-label={spoken(shown)} suppressHydrationWarning>
          {text}
        </span>
      </time>
      {controls ? (
        <span className="z-timer__actions">
          <Button
            size="sm"
            variant={running ? "secondary" : "primary"}
            className="z-timer__toggle"
            icon={running ? "pause" : "play"}
            disabled={mode === "countdown" && !total}
            onClick={running ? pause : start}
          >
            {running ? pauseLabel : state === "paused" ? resumeLabel : startLabel}
          </Button>
          <Button size="sm" variant="ghost" className="z-timer__reset" icon="arrow-path" disabled={state === "idle"} onClick={reset}>
            {resetLabel}
          </Button>
        </span>
      ) : null}
      <span className="z-sr-only z-timer__status" role="status">
        {message}
      </span>
    </div>
  );
});
