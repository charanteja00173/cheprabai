const fs = require('fs');
const path = require('path');

const targetPath = '/Users/charantejaperala/Downloads/Projects/cheprabai/src/components/Chat.js';
let content = fs.readFileSync(targetPath, 'utf8');

console.log("Starting Chat.js Poll Creator patch execution...");

// 1. Update poll question input style to include boxSizing: "border-box"
const oldPollQuestionStyle = `              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                outline: "none"
              }}`;

const newPollQuestionStyle = `              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                outline: "none",
                boxSizing: "border-box"
              }}`;

if (content.includes(oldPollQuestionStyle)) {
  content = content.replace(oldPollQuestionStyle, newPollQuestionStyle);
  console.log("- Added boxSizing: 'border-box' to poll question input.");
} else {
  console.warn("⚠️ Poll question input style block not found or already modified.");
}

// 2. Update poll option inputs to include boxSizing: "border-box"
const oldPollOptionStyle = `                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.07)",
                    color: "#fff",
                    outline: "none"
                  }}`;

const newPollOptionStyle = `                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.07)",
                    color: "#fff",
                    outline: "none",
                    boxSizing: "border-box"
                  }}`;

if (content.includes(oldPollOptionStyle)) {
  content = content.replace(oldPollOptionStyle, newPollOptionStyle);
  console.log("- Added boxSizing: 'border-box' to poll option inputs.");
} else {
  console.warn("⚠️ Poll option inputs style block not found or already modified.");
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Poll Creator patch complete successfully.");
