"use client";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./Icon";
const stages: {
  label: string;
  icon: IconName;
  title: string;
  detail: string;
}[] = [
  {
    label: "Chat",
    icon: "chat",
    title: "Keep the conversation private.",
    detail:
      "Discuss the scope with your client or freelancer in an encrypted room.",
  },
  {
    label: "Offer",
    icon: "file",
    title: "Put the agreement in writing.",
    detail:
      "Set the price, deliverables, and deadline before either side commits.",
  },
  {
    label: "Escrow",
    icon: "shield",
    title: "Reserve payment for the work.",
    detail:
      "The client funds escrow after accepting the offer. Delivery stays in the room.",
  },
  {
    label: "Settle",
    icon: "check",
    title: "Approve the work. Release payment.",
    detail:
      "Review delivery, request a revision, or approve it for settlement on Canton.",
  },
];
export function DealPath() {
  const [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      setPlaying(true);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setStep((v) => (v + 1) % stages.length),
      5000,
    );
    return () => clearInterval(timer);
  }, [playing]);
  const stage = stages[step];
  return (
    <div className="deal-path">
      <div className="path-caption">
        <span>HOW A DEAL WORKS</span>
        <button
          type="button"
          className="path-pause"
          aria-label={playing ? "Pause deal animation" : "Play deal animation"}
          onClick={() => setPlaying((v) => !v)}
        >
          <Icon name={playing ? "pause" : "play"} />
        </button>
      </div>
      <div className="path-card" key={step}>
        <span className="path-symbol">
          <Icon name={stage.icon} />
        </span>
        <div>
          <span className="path-step">0{step + 1} / 04</span>
          <h2>{stage.title}</h2>
          <p>{stage.detail}</p>
        </div>
      </div>
      <div className="path-stages" aria-label="Explore the deal flow">
        {stages.map((s, i) => (
          <button
            type="button"
            key={s.label}
            aria-pressed={i === step}
            className={i === step ? "active" : ""}
            onClick={() => {
              setStep(i);
              setPlaying(false);
            }}
          >
            <span>
              <Icon name={s.icon} />
            </span>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
