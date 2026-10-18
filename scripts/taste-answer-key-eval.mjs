// Compares the tag-dishes prompt against sh's hand-scored answer key.
// Usage: ANTHROPIC_API_KEY=... npx tsx scripts/taste-answer-key-eval.mjs [data/taste-answer-key.xlsx]
import Anthropic from "@anthropic-ai/sdk";
import ExcelJS from "exceljs";
// Dynamic import: tsx loads this .ts module as CommonJS, which static named imports can't read.
const { MODEL, OUTPUT_SCHEMA, SYSTEM_PROMPT, TASTE_AXES } =
  await import("../supabase/functions/_shared/tasteTagging.ts");

const TOLERANCE = 1.5;
// These dishes are the worked examples inside SYSTEM_PROMPT, so they are reported apart.
const PROMPT_EXAMPLES = new Set(["hainanese chicken rice", "laksa", "chendol", "assam fish"]);

async function readAnswerKey(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.getWorksheet("Answer key") ?? workbook.worksheets[0];
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const dish = String(row.getCell(1).value ?? "").trim();
    const description = String(row.getCell(2).value ?? "").trim();
    const scores = TASTE_AXES.map((_, index) => {
      const value = row.getCell(3 + index).value;
      return value === null || value === "" ? null : Number(value);
    });
    if (!dish || scores.some((score) => score === null || !Number.isFinite(score))) return;
    rows.push({ dish, description, scores });
  });
  return rows;
}

async function scoreDish(anthropic, { dish, description }) {
  const lines = [`Dish: ${dish}`];
  if (description) lines.push(`Description: ${description}`);
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: lines.join("\n") }],
  });
  if (response.stop_reason !== "end_turn") {
    throw new Error(`stopped with ${response.stop_reason}`);
  }
  const text = response.content.find((block) => block.type === "text")?.text ?? "";
  return JSON.parse(text);
}

function summarise(label, results) {
  if (results.length === 0) return;
  const agreeing = results.filter((result) => result.diffs.every((diff) => diff <= TOLERANCE));
  console.log(
    `\n${label}: ${agreeing.length}/${results.length} dishes within ${TOLERANCE} on every axis ` +
      `(${Math.round((agreeing.length / results.length) * 100)}%)`,
  );
  const perAxis = TASTE_AXES.map((axis, index) => {
    const mean = results.reduce((sum, result) => sum + result.diffs[index], 0) / results.length;
    const within = results.filter((result) => result.diffs[index] <= TOLERANCE).length;
    return `${axis} avg off ${mean.toFixed(1)}, ${within}/${results.length} within`;
  });
  console.log(`  ${perAxis.join("\n  ")}`);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY in your shell first.");
    process.exit(1);
  }
  const filePath = process.argv[2] ?? "data/taste-answer-key.xlsx";
  const key = await readAnswerKey(filePath);
  if (key.length === 0) {
    console.error(`No fully scored rows in ${filePath}.`);
    process.exit(1);
  }

  const anthropic = new Anthropic();
  const results = [];
  for (const row of key) {
    try {
      const ai = await scoreDish(anthropic, row);
      const aiScores = TASTE_AXES.map((axis) => Number(ai[axis]));
      const diffs = aiScores.map((score, index) => Math.abs(score - row.scores[index]));
      results.push({ ...row, aiScores, diffs, confidence: Number(ai.confidence) });
      const misses = TASTE_AXES.flatMap((axis, index) =>
        diffs[index] > TOLERANCE
          ? [`${axis} you ${row.scores[index]} vs AI ${aiScores[index]}`]
          : [],
      );
      console.log(
        `${misses.length === 0 ? "ok  " : "MISS"} ${row.dish} (confidence ${ai.confidence})` +
          (misses.length > 0 ? `: ${misses.join(", ")}` : ""),
      );
    } catch (error) {
      console.log(`FAIL ${row.dish}: ${error.message}`);
    }
  }

  const isExample = (result) => PROMPT_EXAMPLES.has(result.dish.toLowerCase());
  summarise(
    "Answer key (excluding prompt examples)",
    results.filter((result) => !isExample(result)),
  );
  summarise("Prompt examples", results.filter(isExample));
}

await main();
