export function sendProposalEmail(to: string, proposalData: any, pdfUrl?: string) {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #4f46e5;">Proposal: ${proposalData.title}</h2>
        <p>Hello,</p>
        <p>We've prepared a new proposal for you. Please find the details below:</p>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>Total Amount:</strong> ${proposalData.currency || '$'}${proposalData.pricing}</p>
        </div>
        ${pdfUrl ? `<p>You can download the full PDF proposal here: <br/><a href="${pdfUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Download Proposal</a></p>` : ''}
        <p>If you have any questions, feel free to reach out.</p>
        <p>Best regards,<br/>AutoFlow Agency</p>
      </div>
    `;
}

export function sendInvoiceEmail(to: string, invoiceData: any, pdfUrl?: string) {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #4f46e5;">Invoice: ${invoiceData.invoice_number || 'New Invoice'}</h2>
        <p>Hello,</p>
        <p>You have a new invoice ready for payment. Details are below:</p>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>Amount Due:</strong> ${invoiceData.currency || '$'}${invoiceData.amount}</p>
          <p><strong>Due Date:</strong> ${invoiceData.due_date ? new Date(invoiceData.due_date).toLocaleDateString() : 'N/A'}</p>
        </div>
        ${pdfUrl ? `<p>You can download your invoice PDF here: <br/><a href="${pdfUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Download Invoice</a></p>` : ''}
        <p>Thank you for your business!</p>
        <p>Best regards,<br/>AutoFlow Agency</p>
      </div>
    `;
}

export function sendWelcomeEmail(to: string, userData: any) {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #4f46e5;">Welcome to AutoFlow Agency CRM</h2>
        <p>Hello ${userData.name || 'there'},</p>
        <p>Welcome! We're excited to have you on board. You can now start managing your proposals and invoices easily.</p>
        <p>Best regards,<br/>AutoFlow Agency</p>
      </div>
    `;
}
