import "server-only";

const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

export type TallyPayment = { date: Date; party: string; amount: number; narration: string; guid: string };

/**
 * Payment vouchers in Tally's XML import format. Party ledger is debited, the bank ledger credited.
 * Ledgers must already exist in Tally. Try a small batch first: ledger names and company setup vary.
 */
export function tallyPayments(company: string, bankLedger: string, rows: TallyPayment[]) {
  const v = rows.map((r) => `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER REMOTEID="${x(r.guid)}" VCHTYPE="Payment" ACTION="Create" OBJVIEW="Accounting Voucher View"><DATE>${ymd(r.date)}</DATE><VOUCHERTYPENAME>Payment</VOUCHERTYPENAME><NARRATION>${x(r.narration)}</NARRATION><PARTYLEDGERNAME>${x(r.party)}</PARTYLEDGERNAME><ALLLEDGERENTRIES.LIST><LEDGERNAME>${x(r.party)}</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-${r.amount.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST><ALLLEDGERENTRIES.LIST><LEDGERNAME>${x(bankLedger)}</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>${r.amount.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST></VOUCHER></TALLYMESSAGE>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${x(company)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC><REQUESTDATA>${v}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>\n`;
}
