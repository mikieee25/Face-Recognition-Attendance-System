const fs = require('fs');
const path = 'app/src/components/schedule/SchedulePageClient.tsx';
let content = fs.readFileSync(path, 'utf8');

const badCode = `  useEffect(() => {
    if (!open) {
      setSelectedDate(null);
      setOverrides({});
      return;
    }

    const firstDate = \`\${year}-\${String(month + 1).padStart(2, "0")}-01\`;
    setSelectedDate(firstDate);
  }, [month, open, year]);`;

const goodCode = `  const [prevMonth, setPrevMonth] = useState(month);
  const [prevYear, setPrevYear] = useState(year);

  // Derive state from props during render (React 18 recommended way to reset/adjust state on prop changes)
  if (month !== prevMonth || year !== prevYear) {
    setPrevMonth(month);
    setPrevYear(year);
    if (open) {
      setSelectedDate(\`\${year}-\${String(month + 1).padStart(2, "0")}-01\`);
    }
  }`;

content = content.replace(badCode, goodCode);
fs.writeFileSync(path, content);
console.log("Fixed useEffect issue");
