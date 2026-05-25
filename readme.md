# SettleUp (Sanin's)

A focused offline-first PWA for one job: know who owes you money and who you owe.

## V1 scope

- Add people with optional payment phone numbers.
- Add or edit a payment number later from the person card.
- Delete a person after a warning confirmation.
- Copy a payment phone number to your local clipboard.
- Log money as `Owes me` or `I Owe`.
- Split a group bill equally or with custom per-person amounts.
- Choose Indian Rupee or Omani Rial for each entry.
- See per-person running balances and your net position.
- Record full or partial settlements.
- Delete an incorrect ledger log after a warning confirmation.
- Copy a weekly outstanding digest.
- Install to home screen from the browser.
- Store data locally in IndexedDB and cache the app with a service worker.

## Good next features

- Data backup and restore with an encrypted JSON export.
- Optional reminder date per entry.
- Person-level notes for payment details like UPI ID.
- Edit and delete entries with a confirmation step.
- Monthly archive view for settled history.
- Optional cloud sync after the local-first flow feels right.

## Run locally

```powershell
python -m http.server 5206 -d "C:\GymBuddyIndia\Apps\Expense tracker-"
```

Then open `http://localhost:5206/index.html?v=8`.
