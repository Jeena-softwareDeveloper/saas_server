const fs = require('fs');

let content = fs.readFileSync('src/prisma/schema.prisma', 'utf8');

// Replace url with schemas
content = content.replace(/url\s*=\s*env\("DATABASE_URL"\)/g, 'schemas = ["ecommerce", "public"]');

// Add previewFeatures
content = content.replace(
  /generator client \{\n  provider        = "prisma-client-js"\n\}/,
  'generator client {\n  provider        = "prisma-client-js"\n  previewFeatures = ["multiSchema"]\n}'
);

const lines = content.split('\n');
let inModelOrEnum = false;
let blockType = '';
let openBraces = 0;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].match(/^(model|enum) /)) {
    inModelOrEnum = true;
    blockType = lines[i].split(' ')[0];
  }
  if (inModelOrEnum) {
    if (lines[i].includes('{')) openBraces++;
    if (lines[i].includes('}')) {
      openBraces--;
      if (openBraces === 0) {
        inModelOrEnum = false;
        // Insert @@schema before closing brace
        lines.splice(i, 0, `  @@schema("ecommerce")`);
        i++; // skip the newly inserted line
      }
    }
  }
}

fs.writeFileSync('src/prisma/schema.prisma', lines.join('\n'));
console.log('schema.prisma updated with multiSchema!');
