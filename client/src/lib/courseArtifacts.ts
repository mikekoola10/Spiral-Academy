/**
 * Final artifacts — the finished thing a student leaves each course with.
 *
 * Every name here is grounded in the course's actual curriculum
 * (server/seed/*.json): the capstone exercise, final lesson checklist, or
 * build-along project the lessons themselves assign. If a course's lessons
 * don't produce it, it isn't listed here.
 */
export interface CourseArtifact {
  /** Short name of the finished thing, e.g. "Your own fine-tuned model". */
  name: string;
  /** One line on what it is and how the course produces it. */
  detail: string;
}

export const COURSE_ARTIFACTS: Record<number, CourseArtifact> = {
  // AI Fundamentals — every lesson ends in a "Your turn" exercise run on the
  // student's real life; the final lesson completes the safety checklist.
  4: {
    name: "Your personal AI playbook",
    detail:
      "Prompts you tested on a real task from your own life, a rewritten power prompt, and your completed AI safety checklist.",
  },
  // Prompt Engineering — the capstone lesson has the student run one workflow
  // end to end and document it, saving winning prompts to their prompt journal.
  5: {
    name: "Your first documented AI workflow",
    detail:
      "A real writing, research, or coding workflow you ran end to end and wrote up — plus the prompt journal you build along the way.",
  },
  // AI Tools for Productivity — lesson checklists produce real work: emails
  // from messy notes, a working spreadsheet formula, a finished AI graphic.
  6: {
    name: "Your AI productivity kit",
    detail:
      "Go-to prompt templates, an AI-generated formula working in a real spreadsheet, and a finished graphic you made yourself.",
  },
  // Python for AI — the final lesson builds a reusable ask_llm() function and
  // puts it to work on real tasks (summarizer, tone-fixer).
  7: {
    name: "A Python program that talks to AI",
    detail:
      "Your own ask_llm() tool, written from scratch and put to work on real tasks like summarizing and fixing tone.",
  },
  // Build AI Apps with APIs — the final lesson builds a complete RAG pipeline
  // (chunk, embed, retrieve, answer with sources) over the student's own docs.
  8: {
    name: "A Q&A app over your own documents",
    detail:
      "A working retrieval (RAG) pipeline you built and tested — it answers from your documents and admits when it doesn't know.",
  },
  // AI Agents in Practice — the course builds a capstone agent (ReAct loop,
  // memory, planning); the final module adds evals and operational guardrails.
  9: {
    name: "Your capstone agent, shipped safely",
    detail:
      "A working agent you built yourself — with memory, an eval suite, guardrails, spend budgets, and a kill switch.",
  },
  // ML Engineering — each lesson's exercise produces a piece of one plan for
  // a model the student owns: pipeline, features, SLO, drift alerts, checklist.
  10: {
    name: "A production deployment plan for your model",
    detail:
      "Pipeline and feature designs, a serving SLO, drift alerts, and a ship-readiness checklist — built piece by piece across the course.",
  },
  // Fine-Tuning LLMs — students curate SFT data, LoRA/QLoRA-tune on a single
  // GPU, evaluate against the base model, align with DPO, and serve it.
  11: {
    name: "Your own fine-tuned model",
    detail:
      "A model you curated data for, tuned on a single GPU, evaluated against the base model, and served — with a one-change rollback.",
  },
};

export function getCourseArtifact(courseId: number): CourseArtifact | null {
  return COURSE_ARTIFACTS[courseId] ?? null;
}
