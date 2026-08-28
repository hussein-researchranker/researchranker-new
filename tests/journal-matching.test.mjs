import test from "node:test";
import assert from "node:assert/strict";

import {
  findScimagoMatch,
  getTitleTokens,
  normalizeJournalTitle,
  splitIssns,
} from "../lib/journal-matching.mjs";

function journal({ title, issn = "", quartile = "Q1" }) {
  return {
    title,
    normalizedTitle: normalizeJournalTitle(title),
    titleTokens: getTitleTokens(title),
    issns: splitIssns(issn),
    quartile,
    sjr: "1.5",
    hIndex: "100",
    publisher: "Test Publisher",
    categories: "Test category",
  };
}

test("ISSN matching ignores punctuation but requires a valid 8-character ISSN", () => {
  const journals = [journal({ title: "Renal Research", issn: "1234-567X" })];

  const match = findScimagoMatch(
    { journal: "Different title", issn: "1234 567X" },
    journals
  );

  assert.equal(match?.journal.title, "Renal Research");
  assert.equal(match?.confidence, "ISSN exact match");
  assert.deepEqual(splitIssns("1234; 1234-567X"), ["1234567X"]);
});

test("invalid short ISSNs cannot create an exact-match false positive", () => {
  const journals = [journal({ title: "Unrelated Journal", issn: "1234" })];

  const match = findScimagoMatch(
    { journal: "Completely Different Source", issn: "1234" },
    journals
  );

  assert.equal(match, null);
});

test("ISSN evidence takes precedence over a competing exact title", () => {
  const issnJournal = journal({
    title: "Correct By ISSN",
    issn: "1111-2222",
    quartile: "Q1",
  });
  const titleJournal = journal({
    title: "Target Journal",
    issn: "3333-4444",
    quartile: "Q4",
  });

  const match = findScimagoMatch(
    { journal: "Target Journal", issn: "1111-2222" },
    [titleJournal, issnJournal]
  );

  assert.equal(match?.journal.title, "Correct By ISSN");
  assert.equal(match?.journal.quartile, "Q1");
  assert.equal(match?.confidence, "ISSN exact match");
});

test("normalized exact journal titles match safely", () => {
  const journals = [
    journal({ title: "The Journal of Clinical Biochemistry", issn: "2222-3333" }),
  ];

  const match = findScimagoMatch(
    { journal: "Journal of Clinical Biochemistry", issn: "" },
    journals
  );

  assert.equal(match?.journal.title, "The Journal of Clinical Biochemistry");
  assert.equal(match?.confidence, "Journal title exact match");
});

test("strict token matching accepts a highly similar multi-token title", () => {
  const journals = [
    journal({
      title: "Journal of Molecular and Cellular Cardiology",
      issn: "4444-5555",
    }),
  ];

  const match = findScimagoMatch(
    { journal: "Molecular Cellular Cardiology", issn: "" },
    journals
  );

  assert.equal(match?.journal.title, "Journal of Molecular and Cellular Cardiology");
  assert.match(match?.confidence || "", /^Journal title strict token match \(1\.00\)$/);
});

test("weak token overlap is rejected", () => {
  const journals = [
    journal({ title: "Journal of Molecular and Cellular Cardiology" }),
  ];

  const match = findScimagoMatch(
    { journal: "Molecular Cardiology Research Methods", issn: "" },
    journals
  );

  assert.equal(match, null);
});

test("one generic shared token cannot trigger a strict match", () => {
  const journals = [journal({ title: "International Journal of Medicine" })];

  const match = findScimagoMatch(
    { journal: "Medicine", issn: "" },
    journals
  );

  assert.equal(match, null);
});

test("missing journal and ISSN evidence returns no match", () => {
  const journals = [journal({ title: "Clinical Chemistry", issn: "5555-6666" })];

  assert.equal(findScimagoMatch({ journal: "", issn: "" }, journals), null);
});
