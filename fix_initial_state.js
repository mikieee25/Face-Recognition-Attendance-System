const fs = require('fs');
const path = 'app/src/components/schedule/SchedulePageClient.tsx';
let content = fs.readFileSync(path, 'utf8');

const badState = `const [selectedDate, setSelectedDate] = useState<string | null>(null);`;
// Note: year and month are extracted below this line, so we cannot use them in useState directly unless we move them up.
// Let's just change how it is initialized.

const replacement = `const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const [selectedDate, setSelectedDate] = useState<string | null>(
    \`\${year}-\${String(month + 1).padStart(2, "0")}-01\`
  );`;

// First remove the year/month lines
content = content.replace(
  /  const year = currentDate\.getFullYear\(\);\n  const month = currentDate\.getMonth\(\);\n/g,
  ""
);

// Then replace the useState line with the replacement
content = content.replace(badState, replacement);

fs.writeFileSync(path, content);
console.log("Fixed initial state");
