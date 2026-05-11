// UPI deep-link helper. Generates standard upi:// URI that opens
// PhonePe / GPay / Paytm / BHIM / any UPI app on the user's phone.
// Spec: https://www.npci.org.in/what-we-do/upi/product-overview

export interface UpiPayParams {
  payeeVpa: string;        // e.g. 9876543210@upi
  payeeName: string;       // shown in the UPI app
  amount?: number;         // INR
  note?: string;           // remark
  txnRef?: string;         // transaction ref id
}

export function isValidUpiId(vpa: string): boolean {
  // basic check: something@something
  return /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(vpa.trim());
}

export function buildUpiLink({ payeeVpa, payeeName, amount, note, txnRef }: UpiPayParams): string {
  const params = new URLSearchParams();
  params.set("pa", payeeVpa.trim());
  params.set("pn", payeeName);
  params.set("cu", "INR");
  if (amount && amount > 0) params.set("am", amount.toFixed(2));
  if (note) params.set("tn", note.slice(0, 80));
  if (txnRef) params.set("tr", txnRef);
  return `upi://pay?${params.toString()}`;
}
