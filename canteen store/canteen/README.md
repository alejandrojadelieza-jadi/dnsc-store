# Jadi Shop POS Kiosk (IT415 Practical Exam)

Touchscreen self-service POS kiosk. Plain HTML, CSS, JavaScript. No install or build step.

## Run
1. Open this folder in VS Code (`File > Open Folder`).
2. Install the **Live Server** extension, right-click `index.html`, choose **Open with Live Server**.
   (Double-clicking `index.html` also works.)

## Flow
Select Items -> Review Order -> Payment Method (Cash / QR / Card) -> Payment Successful -> Receipt -> New Transaction

## Files
- `index.html` screens and layout
- `css/style.css` blue theme, large touch targets
- `js/app.js` cart, validation, payments, receipt, reset

## Design choices
- Hard-coded product array: simple, no server, easy to explain.
- Transaction numbers use a counter in localStorage (`TXN-2026-00001`), so they never repeat.
- QR and card payments are simulated. Cash validates blank, negative, and insufficient amounts.

## Suggested Git workflow
`git init`, then use feature branches (e.g. `feature/cart`, `feature/payment`, `feature/receipt`), commit often, open pull requests, review, and merge. Document AI prompts used in `AI_LOG.md`.
