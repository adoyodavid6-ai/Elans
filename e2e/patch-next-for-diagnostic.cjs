// CI diagnostic only: makes Next.js include React's component stack in hydration error messages.
// Never used for the real build or deployment.
const fs = require("fs");
const p = "node_modules/next/dist/client/react-client-callbacks/on-recoverable-error.js";
let s = fs.readFileSync(p, "utf8");
const from = "const onRecoverableError = (error)=>{";
if (!s.includes(from)) { console.log("patch target not found"); process.exit(0); }
s = s.replace(from, "const onRecoverableError = (error, errorInfo)=>{ try { if (errorInfo && errorInfo.componentStack && error && typeof error === 'object') { const c = ('cause' in error && error.cause) || error; c.message = String(c.message) + ' @@STACK@@' + errorInfo.componentStack.split('\\n').map((x) => x.trim()).filter(Boolean).slice(0, 30).join(' | '); } } catch (e) {}");
fs.writeFileSync(p, s);
console.log("patched");
