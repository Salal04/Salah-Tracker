import type { QazaRepository } from "./repository";
import type { QazaOperation, QazaRecord } from "./types";

export type QazaReviewAnswer = "yes" | "no" | "not_sure";

const operationTypeByAnswer: Record<QazaReviewAnswer, QazaOperation["type"]> = {
  yes: "CONFIRM_OFFERED",
  no: "CONFIRM_MISSED",
  not_sure: "DEFER_CONFIRMATION",
};

const uniqueOperationId = (recordId: string, answer: QazaReviewAnswer, createdAt: string): string => {
  const randomId = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10);
  return `qaza-review-${recordId}-${answer}-${createdAt}-${randomId}`;
};

/** Persist a review operation and apply the answer to its Qaza record. */
export const answerQazaReview = async (
  repository: QazaRepository,
  recordId: string,
  answer: QazaReviewAnswer,
  now = new Date(),
): Promise<QazaRecord> => {
  const record = await repository.getById(recordId);
  if (!record || record.status !== "pending_confirmation") throw new Error("This Qaza record is no longer awaiting confirmation.");

  const createdAt = now.toISOString();
  const operation: QazaOperation = {
    operationId: uniqueOperationId(record.id, answer, createdAt),
    type: operationTypeByAnswer[answer],
    recordId: record.id,
    year: record.year,
    createdAt,
    status: "pending",
  };
  await repository.addOperation(operation);

  const reviewed: QazaRecord = answer === "yes"
    ? { ...record, status: "offered", offeredAt: createdAt }
    : answer === "no"
      ? { ...record, status: "outstanding" }
      : record;

  if (reviewed.status !== record.status) await repository.putRecords([reviewed]);
  return reviewed;
};
