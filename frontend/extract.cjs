const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const files = [
  'PartyTab.jsx', 'PomodoroPanel.jsx', 'PremiumUpgradeModal.jsx', 'PrestigePanel.jsx', 
  'PrivacyPanel.jsx', 'ProjectionTable.jsx', 'RankBadge.jsx', 'RankRoadTable.jsx', 
  'RankUpFlash.jsx', 'ReminderControl.jsx', 'ResetPanel.jsx', 'RivalTab.jsx', 'SkillPanel.jsx', 
  'StreakControl.jsx', 'TabErrorBoundary.jsx'
];

const results = {};

files.forEach(f => {
  const filePath = 'src/components/mindos/' + f;
  if (!fs.existsSync(filePath)) {
    console.error('Missing ' + filePath);
    return;
  }
  
  const code = fs.readFileSync(filePath, 'utf8');
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  
  const strings = new Set();
  
  traverse(ast, {
    JSXText(path) {
      const text = path.node.value.trim();
      if (text.length > 0 && /[a-zA-Z]/.test(text)) {
        strings.add(text);
      }
    },
    JSXAttribute(path) {
      const name = path.node.name.name;
      if (['title', 'placeholder', 'alt', 'label'].includes(name) && path.node.value && path.node.value.type === 'StringLiteral') {
        const text = path.node.value.value.trim();
        if (text.length > 0 && /[a-zA-Z]/.test(text)) {
          strings.add(text);
        }
      }
    }
  });
  
  results[f] = Array.from(strings);
});

fs.writeFileSync('C:/Users/kubso/.gemini/antigravity-ide/brain/63b5cf43-a5e8-4f27-b4bc-12f1f6bda6f4/scratch/extracted_strings.json', JSON.stringify(results, null, 2));
console.log('Extraction complete.');
