const fs = require('fs');
const path = require('path');

const targetPath = '/Users/charantejaperala/Downloads/Projects/cheprabai/src/components/Chat.js';
let content = fs.readFileSync(targetPath, 'utf8');

console.log("Starting Chat.js UI patch execution...");

// 1. Add FaPlus import at the top
const clockImport = '  FaClock,';
const newClockImport = '  FaClock,\n  FaPlus,';
if (content.includes(clockImport) && !content.includes('  FaPlus,')) {
  content = content.replace(clockImport, newClockImport);
  console.log("- Added FaPlus import.");
}

// 2. Patch InputPill
const oldInputPill = `const InputPill = styled.div\`
  display: flex;
  align-items: center;
  flex: 1;
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 24px;
  padding: 4px 8px;
  gap: 4px;
  min-width: 0;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.25s ease;

  &:focus-within {
    border-color: var(--chakra-colors-brandPrimary);
    box-shadow: 
      inset 0 2px 4px rgba(0, 0, 0, 0.05),
      0 0 15px var(--chakra-colors-brandGlow);
    background: var(--chakra-colors-surface);
  }

  @media (max-width: \${BREAKPOINTS.md}px) {
    padding: 6px 8px;
    border-radius: 24px;
    gap: 4px;
  }
\`;`;

const newInputPill = `const InputPill = styled.div\`
  display: flex;
  align-items: center;
  flex: 1;
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 24px;
  padding: 4px 8px;
  gap: 4px;
  min-width: 0;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.25s ease;
  box-sizing: border-box;

  &:focus-within {
    border-color: var(--chakra-colors-brandPrimary);
    box-shadow: 
      inset 0 2px 4px rgba(0, 0, 0, 0.05),
      0 0 15px var(--chakra-colors-brandGlow);
    background: var(--chakra-colors-surface);
  }

  @media (max-width: \${BREAKPOINTS.md}px) {
    padding: 2px 6px;
    border-radius: 20px;
    gap: 2px;
  }
\`;`;

if (content.includes(oldInputPill)) {
  content = content.replace(oldInputPill, newInputPill);
  console.log("- Patched InputPill definition.");
} else {
  console.warn("⚠️ InputPill block not found or already modified.");
}

// 3. Patch MessageInput styled component
const oldMessageInput = `const MessageInput = styled.textarea\`
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: var(--chakra-colors-textPrimary);
  outline: none;
  font-size: 0.95rem;
  box-shadow: none;
  resize: none;
  overflow-y: auto;
  max-height: 150px;
  line-height: 1.4;
  font-family: inherit;

  &::placeholder {
    color: var(--chakra-colors-textSecondary);
    opacity: 0.6;
  }

  @media (max-width: \${BREAKPOINTS.md}px) {
    padding: 10px 12px;
    font-size: 16px;
    min-height: 42px;
    line-height: 1.4;
  }
\`;`;

const newMessageInput = `const MessageInput = styled.textarea\`
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: var(--chakra-colors-textPrimary);
  outline: none;
  font-size: 0.95rem;
  box-shadow: none;
  resize: none;
  overflow-y: auto;
  max-height: 150px;
  line-height: 1.4;
  font-family: inherit;
  box-sizing: border-box;

  &::placeholder {
    color: var(--chakra-colors-textSecondary);
    opacity: 0.6;
  }

  @media (max-width: \${BREAKPOINTS.md}px) {
    padding: 6px 8px;
    font-size: 16px;
    min-height: 36px;
    line-height: 1.35;
  }
\`;`;

if (content.includes(oldMessageInput)) {
  content = content.replace(oldMessageInput, newMessageInput);
  console.log("- Patched MessageInput styled component definition.");
} else {
  console.warn("⚠️ MessageInput block not found or already modified.");
}

// 4. Patch AccessoryRow styled component
const oldAccessoryRow = `const AccessoryRow = styled.div\`
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 16px;
  padding: 6px 12px;
  margin-bottom: 4px;
  gap: 8px;
  animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  @keyframes slideDown {
    from { transform: translateY(8px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @media (max-width: \${BREAKPOINTS.sm}px) {
    justify-content: center;
    gap: 14px;
    padding: 8px 12px;
    flex-wrap: wrap;
  }
\`;`;

const newAccessoryRow = `const AccessoryRow = styled.div\`
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: var(--chakra-colors-badgeBg);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 16px;
  padding: 6px 12px;
  margin-bottom: 4px;
  gap: 8px;
  animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  @keyframes slideDown {
    from { transform: translateY(8px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @media (max-width: \${BREAKPOINTS.sm}px) {
    justify-content: flex-start;
    gap: 10px;
    padding: 8px 10px;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    &::-webkit-scrollbar { display: none; }
  }
\`;`;

if (content.includes(oldAccessoryRow)) {
  content = content.replace(oldAccessoryRow, newAccessoryRow);
  console.log("- Patched AccessoryRow styled component definition.");
} else {
  console.warn("⚠️ AccessoryRow block not found or already modified.");
}

// 5. Replace ➕ emoji with FaPlus and rotate transition
const oldPlusButton = `                {isMobile && (
                  <IconButton
                    type="button"
                    onClick={() => setShowMobileActions(!showMobileActions)}
                    title="More Actions"
                    style={{ color: showMobileActions ? "var(--chakra-colors-brandPrimary)" : "inherit", transform: showMobileActions ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}
                  >
                    ➕
                  </IconButton>
                )}`;

const newPlusButton = `                {isMobile && (
                  <IconButton
                    type="button"
                    onClick={() => setShowMobileActions(!showMobileActions)}
                    title="More Actions"
                    style={{ color: showMobileActions ? "var(--chakra-colors-brandPrimary)" : "inherit", transform: showMobileActions ? "rotate(45deg)" : "none", transition: "transform 0.25s" }}
                  >
                    <FaPlus style={{ fontSize: "0.88rem" }} />
                  </IconButton>
                )}`;

if (content.includes(oldPlusButton)) {
  content = content.replace(oldPlusButton, newPlusButton);
  console.log("- Replaced ➕ emoji with rotating FaPlus icon.");
} else {
  console.warn("⚠️ Plus button block not found or already modified.");
}

// 6. Update inner wrapper row alignment from center to flex-end
const oldInnerWrapper = `<div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, width: "100%" }}>`;
const newInnerWrapper = `<div style={{ display: "flex", alignItems: "flex-end", gap: isMobile ? 8 : 12, width: "100%" }}>`;

if (content.includes(oldInnerWrapper)) {
  content = content.replace(oldInnerWrapper, newInnerWrapper);
  console.log("- Set input wrapper alignment to flex-end.");
} else {
  console.warn("⚠️ Inner wrapper div block not found or already modified.");
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Chat.js UI patch complete successfully.");
