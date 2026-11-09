"use client";

import { useState } from "react";
import Link from "next/link";
import { AddQaza } from "@/components/qaza/AddQaza";
import { createIndexedDbQazaRepository } from "@/lib/qaza/repository";
import type { QazaRecord } from "@/lib/qaza/types";
import { buildStatistics } from "@/lib/qaza/stats";

export default function ManualBacklogPage() {
  const [repository] = useState(() => createIndexedDbQazaRepository());

  const saveRecords = async (records: QazaRecord[]) => {
    const createdAt = new Date().toISOString();
    const operations = records.map((record) => ({ operationId: `add-${record.importId}-${record.id}`, type: "ADD_QAZA" as const, recordId: record.id, year: record.year, createdAt, status: "pending" as const, record }));
    const existing = await repository.listAllRecords();
    const statistics = buildStatistics([[...existing, ...records]]);
    await repository.saveRecordsAndOperations(records, operations, statistics);
  };

  return <main className="qaza-backlog-placeholder">
    <div className="qaza-backlog-page">
      <div className="qaza-backlog-top"><Link href="/dashboard">← Return to your tracker</Link></div>
      <AddQaza onSave={saveRecords} />
    </div>
  </main>;
}
