import PDFDocument from 'pdfkit';
import type { Prescription } from '@medical-ai/shared';

export function buildPrescriptionPdf(p: Prescription): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('Medical Prescription', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Issued: ${new Date(p.issued_at).toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    // Parties
    doc.fontSize(11).font('Helvetica-Bold').text('Patient: ', { continued: true })
      .font('Helvetica').text(`${p.patient_name}${p.patient_age ? ` (age ${p.patient_age})` : ''}`);
    doc.font('Helvetica-Bold').text('Doctor: ', { continued: true })
      .font('Helvetica').text(`${p.doctor_name}${p.doctor_specialty ? ` — ${p.doctor_specialty}` : ''}`);
    doc.moveDown();

    // Diagnosis
    doc.font('Helvetica-Bold').text('Diagnosis');
    doc.font('Helvetica').text(p.diagnosis || '(not specified)');
    doc.moveDown();

    // Medications
    doc.font('Helvetica-Bold').text('Medications');
    if (p.medications.length === 0) {
      doc.font('Helvetica').text('(none)');
    } else {
      p.medications.forEach((m, i) => {
        doc.font('Helvetica-Bold').text(`${i + 1}. ${m.name}`);
        doc.font('Helvetica').text(`   Dosage: ${m.dosage}`);
        doc.text(`   Frequency: ${m.frequency}`);
        doc.text(`   Duration: ${m.duration}`);
        if (m.notes) doc.text(`   Notes: ${m.notes}`);
        doc.moveDown(0.3);
      });
    }
    doc.moveDown();

    if (p.instructions) {
      doc.font('Helvetica-Bold').text('Instructions');
      doc.font('Helvetica').text(p.instructions);
      doc.moveDown();
    }

    if (p.follow_up) {
      doc.font('Helvetica-Bold').text('Follow-up');
      doc.font('Helvetica').text(p.follow_up);
      doc.moveDown();
    }

    // Signature line
    doc.moveDown(2);
    doc.text('_________________________', { align: 'right' });
    doc.text(p.doctor_name, { align: 'right' });

    doc.end();
  });
}
