"use client";

import { useState } from "react";
import { Button, Icon, Input, MessageStrip } from "@ui5/webcomponents-react";
import { askMatrix } from "@/lib/ai/client";
import { toFilters, type QuestionFilters } from "@/lib/domain/question";
import { toUserMessage } from "@/lib/fsm/errors";
import type { Skill } from "@/lib/fsm/services/model";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { filterLabel } from "./MatrixFilters";
import styles from "./SkillMatrix.module.css";

interface Props {
  skills: Skill[];
  levelNames: string[];
  onFilters: (filters: QuestionFilters) => void;
}

// A question in plain words becomes filter values. The AI only gets the question and the
// names of skills and levels; the matrix computes the result, and the filters stay visible
// and can be changed by hand.
export function AskMatrix({ skills, levelNames, onFilters }: Props) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  // How the last question ended. The text is built when it is shown, so it follows the language.
  const [outcome, setOutcome] = useState<{ filters?: QuestionFilters; notFound?: string[]; error?: unknown } | null>(null);
  const { t } = useI18n();

  // Says in words which filters were set, so the user sees how the question was read.
  function describe(filters: QuestionFilters): string {
    const and = ` ${t("list.and")} `;
    const or = ` ${t("list.or")} `;
    const parts = [
      filters.search && t("ask.person", { name: filters.search }),
      filters.skillIds.length > 0 && t("ask.skill", { names: filters.skillIds.map((id) => skills.find((skill) => skill.id === id)?.name).join(and) }),
      filters.statuses.length > 0 && t("ask.status", { names: filters.statuses.map((status) => filterLabel(status, t)).join(or) }),
      filters.levels.length > 0 && t("ask.level", { names: filters.levels.join(or) }),
    ];
    return parts.filter(Boolean).join(", ");
  }

  function outcomeText(): string {
    if (outcome?.filters) return t("ask.understood", { filters: describe(outcome.filters) });
    if (outcome?.notFound) return t("ask.notFound", { names: outcome.notFound.join(` ${t("list.or")} `) });
    return outcome?.error === undefined ? t("ask.unclear") : toUserMessage(outcome.error, t);
  }

  async function ask() {
    if (busy || !question.trim()) return;
    setBusy(true);
    setOutcome(null);
    try {
      const answer = await askMatrix(
        question,
        skills.map((skill) => skill.name),
        levelNames,
      );
      const { filters, notFound } = toFilters(answer, skills, levelNames);
      if (filters) onFilters(filters);
      setOutcome(filters ? { filters } : notFound.length > 0 ? { notFound } : {});
    } catch (error) {
      setOutcome({ error });
    }
    setBusy(false);
  }

  return (
    <>
      <div className={styles.filters}>
        <Input
          className={styles.ask}
          placeholder={t("ask.placeholder")}
          accessibleName={t("ask.label")}
          maxlength={300}
          icon={<Icon name="ai" />}
          value={question}
          disabled={busy}
          onInput={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && ask()}
        />
        <Button disabled={busy || !question.trim()} tooltip={t("ask.tooltip")} onClick={ask}>
          {t("ask.button")}
        </Button>
      </div>
      {outcome && (
        <MessageStrip design={outcome.filters ? "Information" : "Critical"} onClose={() => setOutcome(null)}>
          {outcomeText()}
        </MessageStrip>
      )}
    </>
  );
}
