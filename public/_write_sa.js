
const fs = require('fs');
const html = [
'<!doctype html>',
'<html>',
'<head>',
'  <meta charset="utf-8">',
'  <meta name="viewport" content="width=device-width,initial-scale=1">',
'  <title>vBudget - Super Admin</title>',
'  <link rel="stylesheet" href="/style.css">',
'</head>',
'<body>',
'  <h1>Super Admin - PLACEHOLDER</h1>',
'</body>',
'</html>'
].join('\n');
fs.writeFileSync('C:/Users/jensmoeller/code/vbudget/public/superadmin.html', html, 'utf8');
console.log('done: ' + html.length);
