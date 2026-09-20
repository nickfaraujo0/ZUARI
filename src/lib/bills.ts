/** RA (running account) bill maths. GST and TDS are on the gross value; retention is held back from it. */
export function billTotals(lines: { quantity: number; rate: number }[], retentionPct: number, tdsPct: number, gstPct: number) {
  const gross = lines.reduce((s, l) => s + l.quantity * l.rate, 0);
  const gst = (gross * gstPct) / 100, retention = (gross * retentionPct) / 100, tds = (gross * tdsPct) / 100;
  return { gross, gst, retention, tds, net: gross + gst - retention - tds };
}
