const fs = require("fs");
const outPath = "C:/Users/jensmoeller/code/vbudget/public/superadmin.html";

// Read admin.html as reference for structure
// Build superadmin HTML completely in JS
const Q = String.fromCharCode(39); // single quote
const BT = String.fromCharCode(96); // backtick

function buildHTML() {
  // Use template literal since we are inside node, not bash
  return eval(BT + fs.readFileSync("C:/Users/jensmoeller/code/vbudget/public/_sa_template.txt", "utf8") + BT);
}

const html = buildHTML();
fs.writeFileSync(outPath, html, "utf8");
console.log("Written " + html.length + " chars");
