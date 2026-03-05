import fs from 'fs';
import path from 'path';

function getKeys(obj, prefix = '') {
  return Object.keys(obj).reduce((res, el) => {
    if (Array.isArray(obj[el])) return res;
    if (typeof obj[el] === 'object' && obj[el] !== null) {
      return [...res, ...getKeys(obj[el], prefix + el + '.')];
    }
    return [...res, prefix + el];
  }, []);
}

const enJson = JSON.parse(fs.readFileSync('./src/locales/en/translation.json', 'utf8'));
const validKeys = new Set(getKeys(enJson));

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) { 
            results.push(file);
        }
    });
    return results;
}

const files = walk('./src');
const foundKeys = new Set();
const regex = /t\(['"]([^'"]+)['"]/g;

files.forEach(f => {
    const content = fs.readFileSync(f, 'utf8');
    let match;
    while ((match = regex.exec(content)) !== null) {
        foundKeys.add(match[1]);
    }
});

const missing = [];
for (let key of foundKeys) {
    if (!validKeys.has(key)) {
        missing.push(key);
    }
}
console.log('Missing keys:');
missing.forEach(k => console.log(k));
