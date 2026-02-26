#!/bin/bash
BASE="http://localhost:3000/api"
PASS=0
FAIL=0

# Login
TOKEN=$(curl -s $BASE/auth/login -X POST -H 'Content-Type: application/json' -d '{"email":"admin@ca.com","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -n "$TOKEN" ]; then echo "✅ Login"; ((PASS++)); else echo "❌ Login"; ((FAIL++)); fi
AUTH="Authorization: Bearer $TOKEN"

# Dashboard
R=$(curl -s -w "%{http_code}" -o /tmp/dash.json $BASE/dashboard -H "$AUTH")
if [ "$R" = "200" ]; then echo "✅ Dashboard"; ((PASS++)); else echo "❌ Dashboard ($R)"; ((FAIL++)); fi

# Clients
R=$(curl -s -w "%{http_code}" -o /tmp/cl.json $BASE/clients -H "$AUTH")
COUNT=$(cat /tmp/cl.json | grep -o '"id"' | wc -l)
if [ "$R" = "200" ] && [ "$COUNT" -ge 5 ]; then echo "✅ Clients ($COUNT)"; ((PASS++)); else echo "❌ Clients ($R, $COUNT)"; ((FAIL++)); fi

# Tasks
R=$(curl -s -w "%{http_code}" -o /tmp/t.json $BASE/tasks -H "$AUTH")
COUNT=$(cat /tmp/t.json | grep -o '"id"' | wc -l)
if [ "$R" = "200" ]; then echo "✅ Tasks ($COUNT)"; ((PASS++)); else echo "❌ Tasks ($R)"; ((FAIL++)); fi

# Services
R=$(curl -s -w "%{http_code}" -o /tmp/s.json $BASE/services -H "$AUTH")
COUNT=$(cat /tmp/s.json | grep -o '"id"' | wc -l)
if [ "$R" = "200" ] && [ "$COUNT" -ge 10 ]; then echo "✅ Services ($COUNT)"; ((PASS++)); else echo "❌ Services ($R, $COUNT)"; ((FAIL++)); fi

# Users
R=$(curl -s -w "%{http_code}" -o /tmp/u.json $BASE/users -H "$AUTH")
COUNT=$(cat /tmp/u.json | grep -o '"id"' | wc -l)
if [ "$R" = "200" ] && [ "$COUNT" -ge 4 ]; then echo "✅ Users ($COUNT)"; ((PASS++)); else echo "❌ Users ($R, $COUNT)"; ((FAIL++)); fi

# Recurring Rules
R=$(curl -s -w "%{http_code}" -o /dev/null $BASE/recurring-rules -H "$AUTH")
if [ "$R" = "200" ]; then echo "✅ Recurring Rules"; ((PASS++)); else echo "❌ Recurring Rules ($R)"; ((FAIL++)); fi

# Bills
R=$(curl -s -w "%{http_code}" -o /dev/null $BASE/bills -H "$AUTH")
if [ "$R" = "200" ]; then echo "✅ Bills"; ((PASS++)); else echo "❌ Bills ($R)"; ((FAIL++)); fi

# Payments
R=$(curl -s -w "%{http_code}" -o /dev/null $BASE/payments -H "$AUTH")
if [ "$R" = "200" ]; then echo "✅ Payments"; ((PASS++)); else echo "❌ Payments ($R)"; ((FAIL++)); fi

# Followups
R=$(curl -s -w "%{http_code}" -o /dev/null $BASE/followups -H "$AUTH")
if [ "$R" = "200" ]; then echo "✅ Followups"; ((PASS++)); else echo "❌ Followups ($R)"; ((FAIL++)); fi

# Income
R=$(curl -s -w "%{http_code}" -o /dev/null $BASE/income -H "$AUTH")
if [ "$R" = "200" ]; then echo "✅ Income"; ((PASS++)); else echo "❌ Income ($R)"; ((FAIL++)); fi

# Expenses
R=$(curl -s -w "%{http_code}" -o /dev/null $BASE/expenses -H "$AUTH")
if [ "$R" = "200" ]; then echo "✅ Expenses"; ((PASS++)); else echo "❌ Expenses ($R)"; ((FAIL++)); fi

# Document Templates
R=$(curl -s -w "%{http_code}" -o /dev/null $BASE/document-templates -H "$AUTH")
if [ "$R" = "200" ]; then echo "✅ Document Templates"; ((PASS++)); else echo "❌ Document Templates ($R)"; ((FAIL++)); fi

# Activity Logs
R=$(curl -s -w "%{http_code}" -o /dev/null $BASE/activity-logs -H "$AUTH")
if [ "$R" = "200" ]; then echo "✅ Activity Logs"; ((PASS++)); else echo "❌ Activity Logs ($R)"; ((FAIL++)); fi

# Reports - Productivity
R=$(curl -s -w "%{http_code}" -o /dev/null "$BASE/reports/productivity?startDate=2024-01-01&endDate=2027-12-31" -H "$AUTH")
if [ "$R" = "200" ]; then echo "✅ Reports - Productivity"; ((PASS++)); else echo "❌ Reports - Productivity ($R)"; ((FAIL++)); fi

# Reports - Revenue
R=$(curl -s -w "%{http_code}" -o /dev/null "$BASE/reports/revenue?startDate=2024-01-01&endDate=2027-12-31" -H "$AUTH")
if [ "$R" = "200" ]; then echo "✅ Reports - Revenue"; ((PASS++)); else echo "❌ Reports - Revenue ($R)"; ((FAIL++)); fi

# Test Create Client
R=$(curl -s -w "%{http_code}" -o /dev/null $BASE/clients -X POST -H "$AUTH" -H 'Content-Type: application/json' -d '{"name":"Test Client","email":"test@test.com","phone":"1234567890","business_type":"Private Limited"}')
if [ "$R" = "201" ]; then echo "✅ Create Client"; ((PASS++)); else echo "❌ Create Client ($R)"; ((FAIL++)); fi

# Test Create Task
R=$(curl -s -w "%{http_code}" -o /dev/null $BASE/tasks -X POST -H "$AUTH" -H 'Content-Type: application/json' -d '{"title":"Test Task","client_id":1,"service_id":1,"assigned_to":2,"priority":"high","due_date":"2026-03-15"}')
if [ "$R" = "201" ]; then echo "✅ Create Task"; ((PASS++)); else echo "❌ Create Task ($R)"; ((FAIL++)); fi

# Test Create Income
R=$(curl -s -w "%{http_code}" -o /dev/null $BASE/income -X POST -H "$AUTH" -H 'Content-Type: application/json' -d '{"client_id":1,"amount":5000,"description":"Test income","category":"Service Fee","income_date":"2026-02-26"}')
if [ "$R" = "201" ]; then echo "✅ Create Income"; ((PASS++)); else echo "❌ Create Income ($R)"; ((FAIL++)); fi

# Test Create Expense
R=$(curl -s -w "%{http_code}" -o /dev/null $BASE/expenses -X POST -H "$AUTH" -H 'Content-Type: application/json' -d '{"amount":2000,"description":"Office supplies","category":"Stationery","expense_date":"2026-02-26"}')
if [ "$R" = "201" ]; then echo "✅ Create Expense"; ((PASS++)); else echo "❌ Create Expense ($R)"; ((FAIL++)); fi

# Frontend files check
echo ""
echo "--- Frontend Files ---"
for f in index.html css/style.css js/api.js js/app.js js/dashboard.js js/clients.js js/tasks.js js/recurring.js js/staff.js js/billing.js js/followups.js js/income-expenses.js js/documents.js js/reports.js; do
  if [ -f "public/$f" ]; then echo "✅ $f"; ((PASS++)); else echo "❌ $f MISSING"; ((FAIL++)); fi
done

echo ""
echo "========================"
echo "PASSED: $PASS | FAILED: $FAIL"
echo "========================"
