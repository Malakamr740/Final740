import fs from 'fs';
import path from 'path';

const chunkFiles = [
  './scripts/est1_data_1.json',
  './scripts/est1_data_2.json',
  './scripts/est1_data_3.json',
  './scripts/est1_data_4.json',
  './scripts/est1_data_5.json',
];

let allQuestions = [];
for (const file of chunkFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const items = JSON.parse(content);
  allQuestions = allQuestions.concat(items);
}

console.log(`Loaded ${allQuestions.length} questions.`);

// Write directly to /public/est1_math_sample_test_1.json
const outputPath = './public/est1_math_sample_test_1.json';
fs.writeFileSync(outputPath, JSON.stringify(allQuestions, null, 2), 'utf-8');
console.log(`Saved successfully to ${outputPath}`);
