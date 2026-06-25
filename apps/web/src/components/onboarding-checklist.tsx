/**
 * OnboardingChecklist — the guided setup wizard.
 *
 * Shown on the overview while setup is incomplete. Required steps (project → website → first
 * analysis) form a numbered track; the current step is highlighted with its "why" and a primary
 * CTA, earlier steps are marked done, later ones muted. Connecting a data source is an OPTIONAL
 * boost surfaced separately, never blocking completion. Pure/server component.
 */

import Link from "next/link";
import { Icon } from "./icon";
import {
  onboardingSteps,
  isFullySetUp,
  type OnboardingStep,
  type ReadinessState,
} from "../lib/readiness";

export interface OnboardingChecklistProps {
  readiness: ReadinessState;
}

export function OnboardingChecklist({ readiness }: OnboardingChecklistProps) {
  if (isFullySetUp(readiness)) return null;

  const steps = onboardingSteps(readiness);
  const required = steps.filter((step) => !step.optional);
  const optional = steps.filter((step) => step.optional);
  const doneCount = required.filter((step) => step.done).length;
  // The current step is the first incomplete required one.
  const currentIndex = required.findIndex((step) => !step.done);

  return (
    <section className="card onboarding" aria-labelledby="onboarding-heading">
      <div className="onboarding__header">
        <div>
          <p className="kicker">Erste Schritte</p>
          <h2 id="onboarding-heading">In {required.length} Schritten startklar</h2>
          <p className="onboarding__lead">
            Arbeiten Sie die Schritte von oben nach unten ab — der nächste ist hervorgehoben. Schon
            die erste Analyse liefert sofort sichtbare Ergebnisse.
          </p>
        </div>
        <span className="onboarding__progress" aria-label={`${doneCount} von ${required.length} erledigt`}>
          {doneCount}/{required.length}
        </span>
      </div>

      <ol className="onboarding__steps">
        {required.map((step, index) => (
          <StepRow key={step.prerequisite} step={step} index={index} isCurrent={index === currentIndex} />
        ))}
      </ol>

      {optional.length > 0 && (
        <div className="onboarding__optional">
          <p className="onboarding__optional-label">Optional — jederzeit möglich</p>
          {optional.map((step) => (
            <div key={step.prerequisite} className={`onboarding-step is-optional${step.done ? " is-done" : ""}`}>
              <span className="onboarding-step__marker" aria-hidden="true">
                {step.done ? <Icon name="check" /> : <Icon name="auto_awesome" />}
              </span>
              <div className="onboarding-step__body">
                <strong className="onboarding-step__title">{step.title}</strong>
                <span className="onboarding-step__desc">{step.description}</span>
              </div>
              {step.done ? (
                <span className="onboarding-step__status">Verbunden</span>
              ) : (
                <Link className="button secondary onboarding-step__cta" href={step.ctaHref}>
                  {step.ctaLabel}
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StepRow({ step, index, isCurrent }: { step: OnboardingStep; index: number; isCurrent: boolean }) {
  const stateClass = step.done ? "is-done" : isCurrent ? "is-current" : "is-todo";
  return (
    <li className={`onboarding-step ${stateClass}`}>
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
        <span className="onboarding-step__status onboarding-step__status--todo">später</span>
      )}
    </li>
  );
}
