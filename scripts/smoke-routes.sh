#!/usr/bin/env bash
# Requests every public route and prints any non-200 responses.
BASE=${1:-http://localhost:3000}
fail=0
for p in / /solutions /solutions/tax-compliance /solutions/tax-compliance/etims-compliance-reconciliation /solutions/healthcare-admin/sha-claims-scrubber /solutions/customer-service/whatsapp-sales-support-agent \
  /industries /industries/healthcare /industries/education/packs/school-fees-pack /growth /growth/ai-visibility-geo /growth/content-studio \
  /frontier /frontier/agentic-commerce /templates /templates/etims-invoice-check /how-it-works /pricing /pricing/growth /pricing/enterprise \
  /case-studies /resources /resources/etims-expense-validation-guide /resources/reconciliation-vs-matching /integrations /trust /partners /about /careers \
  /contact "/contact?topic=quote&solution=etims-compliance-reconciliation" /legal/privacy /legal/dpa /brand; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$p")
  if [ "$code" != "200" ]; then echo "$code $p"; fail=1; fi
done
[ $fail = 0 ] && echo "all routes 200"
