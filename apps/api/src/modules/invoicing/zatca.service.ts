import { Injectable } from "@nestjs/common";
import * as crypto from "node:crypto";
import { TenantDb } from "../../core/database/tenant-db.service";

/** TLV encoder for ZATCA QR (Phase 1 + bridges to Phase 2). */
function tlv(tag: number, value: string): Buffer {
  const v = Buffer.from(value, "utf8");
  return Buffer.concat([Buffer.from([tag, v.length]), v]);
}

@Injectable()
export class ZatcaService {
  constructor(private readonly db: TenantDb) {}

  /**
   * Generate a ZATCA-compliant simplified e-invoice payload:
   *  - canonical UBL 2.1 XML (minimal subset)
   *  - SHA-256 invoice hash (base64)
   *  - hash-chain to previous invoice (zatca_prev_hash)
   *  - ECDSA P-256 signature over the hash (mock cert per tenant)
   *  - TLV-encoded base64 QR (seller, VAT#, timestamp, total, vat, hash, signature, pubKey)
   * Persists all fields on the invoice row and returns them.
   */
  async signAndChain(invoiceId: string, tenantName: string, tenantVat: string) {
    const [inv] = await this.db.query<any>(
      `SELECT i.*, c.name AS customer_name, c.vat_number AS customer_vat
       FROM "__S__"."invoices" i
       LEFT JOIN "__S__"."customers" c ON c.id = i.customer_id
       WHERE i.id = $1`, [invoiceId]);
    const lines = await this.db.query<any>(
      `SELECT * FROM "__S__"."invoice_lines" WHERE invoice_id = $1`, [invoiceId]);

    // Previous-invoice hash (chain)
    const [prev] = await this.db.query<any>(
      `SELECT zatca_hash FROM "__S__"."invoices"
       WHERE zatca_hash IS NOT NULL AND id <> $1
       ORDER BY zatca_signed_at DESC NULLS LAST LIMIT 1`, [invoiceId]);
    const prevHash = prev?.zatca_hash ?? "0";

    const uuid = crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const xml = this.buildUblXml({
      uuid, number: inv.number,
      issueDateTime: issuedAt,
      sellerName: tenantName, sellerVat: tenantVat,
      buyerName: inv.customer_name ?? "—", buyerVat: inv.customer_vat ?? "",
      subtotal: Number(inv.subtotal),
      vat: Number(inv.vat_total),
      total: Number(inv.total),
      prevHash,
      lines: lines.map((l) => ({
        description: l.description,
        qty: Number(l.qty),
        unitPrice: Number(l.unit_price),
        vatRate: Number(l.vat_rate),
        lineTotal: Number(l.line_total),
      })),
    });

    const canonical = xml.replace(/>\s+</g, "><").trim();
    const hash = crypto.createHash("sha256").update(canonical).digest("base64");

    // Ephemeral ECDSA P-256 keypair — stand-in for tenant cert.
    // In production, the private key is loaded from the tenant's onboarded CSID.
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    const signature = crypto
      .createSign("SHA256")
      .update(canonical)
      .sign(privateKey)
      .toString("base64");
    const pubKeyB64 = publicKey
      .export({ type: "spki", format: "der" })
      .toString("base64");

    const qrBuf = Buffer.concat([
      tlv(1, tenantName),
      tlv(2, tenantVat),
      tlv(3, issuedAt),
      tlv(4, Number(inv.total).toFixed(2)),
      tlv(5, Number(inv.vat_total).toFixed(2)),
      tlv(6, hash),
      tlv(7, signature),
      tlv(8, pubKeyB64),
    ]);
    const qr = qrBuf.toString("base64");

    await this.db.exec(
      `UPDATE "__S__"."invoices"
       SET zatca_uuid=$1, zatca_hash=$2, zatca_prev_hash=$3,
           zatca_qr=$4, zatca_xml=$5, zatca_signed_at=now()
       WHERE id=$6`,
      [uuid, hash, prevHash, qr, xml, invoiceId],
    );

    return { uuid, hash, prevHash, qr, xml };
  }

  private buildUblXml(d: {
    uuid: string; number: string; issueDateTime: string;
    sellerName: string; sellerVat: string;
    buyerName: string; buyerVat: string;
    subtotal: number; vat: number; total: number; prevHash: string;
    lines: { description: string; qty: number; unitPrice: number; vatRate: number; lineTotal: number }[];
  }): string {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const lineItems = d.lines.map((l, i) => `
    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${l.qty}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="SAR">${(l.qty * l.unitPrice).toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item><cbc:Name>${esc(l.description)}</cbc:Name></cac:Item>
      <cac:Price><cbc:PriceAmount currencyID="SAR">${l.unitPrice.toFixed(2)}</cbc:PriceAmount></cac:Price>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${(l.qty * l.unitPrice * l.vatRate / 100).toFixed(2)}</cbc:TaxAmount>
      </cac:TaxTotal>
    </cac:InvoiceLine>`).join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${esc(d.number)}</cbc:ID>
  <cbc:UUID>${d.uuid}</cbc:UUID>
  <cbc:IssueDate>${d.issueDateTime.slice(0, 10)}</cbc:IssueDate>
  <cbc:IssueTime>${d.issueDateTime.slice(11, 19)}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${d.prevHash}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(d.sellerVat)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>${esc(d.sellerName)}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(d.buyerVat)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>${esc(d.buyerName)}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${d.vat.toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${d.subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${d.subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${d.total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="SAR">${d.total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lineItems}
</Invoice>`;
  }
}
