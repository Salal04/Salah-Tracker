"use client";

import { useState } from "react";
import Link from "next/link";
import { AddQaza } from "@/components/qaza/AddQaza";
import { createIndexedDbQazaRepository } from "@/lib/qaza/repository";
import type { QazaRecord } from "@/lib/qaza/types";
import { reconcile } from "@/lib/qaza/stats";

export default function ManualBacklogPage() {
  const [repository] = useState(() => createIndexedDbQazaRepository());

  const saveRecords = async (records: QazaRecord[]) => {
    await repository.putRecords(records);
    const existingOperations = new Set((await repository.listPendingOperations()).map((operation) => operation.operationId));
    const createdAt = new Date().toISOString();
    for (const record of records) {
      const operationId = `add-${record.importId}-${record.id}`;
      if (existingOperations.has(operationId)) continue;
      await repository.addOperation({ operationId, type: "ADD_QAZA", recordId: record.id, year: record.year, createdAt, status: "pending", record });
    }
    await reconcile(repository);
  };

  return <main className="qaza-backlog-placeholder">
    <div className="qaza-backlog-page">
      <div className="qaza-backlog-top"><Link href="/dashboard">← Return to your tracker</Link></div>
      <AddQaza onSave={saveRecords} />
    </div>
  </main>;
}
