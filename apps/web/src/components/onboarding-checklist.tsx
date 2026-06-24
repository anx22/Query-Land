/**
 * OnboardingChecklist — the setup waterfall as a guided, self-checking list.
 *
 * Shown on the overview while setup is incomplete. Each step reflects a
 * prerequisite (project → site → data source → crawl), marks itself done, and
 * links to the action. The first incomplete step is highlighted as "current".
 * Pure/server component; takes the derived ReadinessState.
 */

import Link from "next/link";
import { Icon } from "./icon";
import {
  onboardingSteps,
  currentStepIndex,
  isFullySetUp,
  type ReadinessState,
} from "../lib/readiness";

export interface OnboardingChecklistProps {
  readiness: ReadinessState;
}

export function OnboardingChecklist({ readiness }: OnboardingChecklistProps) {
  if (isFullySetUp(readiness)) return null;

  const steps = onboardingSteps(readiness);
  const current = currentStepIndex(steps);
  const doneCount = steps.filter((step) => step.done).length;

  return (
    <section className="card onboarding" aria-labelledby="onboarding-heading">
      <div className="onboarding__header">
        <div>
          <p className="kicker">Erste Schritte</p>
          <h2 id="onboarding-heading">In 4 Schritten startklar</h2>
          <p className="onboarding__lead">
            Die Funktionen schalten sich der Reihe nach frei. Arbeite die Schritte
            von oben nach unten ab — der nächste ist hervorgehoben.
          </p>
        </div>
        <span className="onboarding__progress" aria-label={`${doneCount} von ${steps.length} erledigt`}>
          {doneCount}/{steps.length}
        </span>
      </div>

      <ol className="onboarding__steps">
        {steps.map((step, index) => {
          const isCurrent = index === current;
          const stateClass = step.done ? "is-done" : isCurrent ? "is-current" : "is-todo";
          return (
            <li key={step.prerequisite} className={`onboarding-step ${stateClass}`}>
              <span className="onboarding-step__marker" aria-hidden="true">
                {step.done ? <Icon name="check" /> : <span>{index + 1}</span>}
              </span>
              <div className="onboarding-step__body">
                <strong className="onboarding-step__title">{step.title}</strong>
                <span className="onboarding-step__desc">{step.description}</span>
              </div>
              {step.done ? (
                <span className="onboarding-step__status">Erledigt</span>
              ) : isCurrent ? (
                <Link className="button primary onboarding-step__cta" href={step.ctaHref}>
                  {step.ctaLabel}
                </Link>
              ) : (
                <span className="onboarding-step__status onboarding-step__status--todo">
                  später
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
