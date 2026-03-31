export const DEFAULT_REQUEST_TEMPLATES = [
  {
    code: 'vendor_standard',
    name: 'Standard Vendor Payment',
    requestType: 'payment_request',
    description: 'Default template for vendor invoices and standard outbound payments.',
    version: 1,
    visibilityMode: 'related_only',
    isActive: true,
    formSchema: {
      fieldMasking: {
        bankAccountNumber: {
          enabled: true,
          visibleTo: ['requester', 'workflow_related', 'finance', 'admin'],
        },
        bankAccountName: {
          enabled: false,
          visibleTo: ['requester', 'workflow_related', 'finance', 'admin'],
        },
        bankName: {
          enabled: false,
          visibleTo: ['requester', 'workflow_related', 'finance', 'admin', 'department_viewer'],
        },
      },
    },
    detailSchema: {
      columns: {
        invoiceDate: { visible: true, required: true },
        invoiceRef: { visible: true, required: true },
        glCode: { visible: true, required: true },
        costCenter: { visible: true, required: true },
        projectCode: { visible: true, required: true },
        expenseTypeCode: { visible: true, required: true },
        currency: { visible: true, required: true },
        exchangeRate: { visible: true, required: true },
        totalAmount: { visible: true, required: false },
        note: { visible: true, required: false },
      },
    },
    attachmentRules: {
      visibilityByType: {
        invoice: {
          sensitive: false,
          visibleTo: ['requester', 'workflow_related', 'finance', 'admin', 'department_viewer'],
        },
        supporting_document: {
          sensitive: false,
          visibleTo: ['requester', 'workflow_related', 'finance', 'admin', 'department_viewer'],
        },
        bank_proof: {
          sensitive: true,
          visibleTo: ['requester', 'workflow_related', 'finance', 'admin'],
        },
      },
      requiredTypes: ['invoice'],
    },
  },
  {
    code: 'finance_sensitive',
    name: 'Finance Sensitive Payment',
    requestType: 'payment_request',
    description: 'Template with stricter masking and tighter attachment visibility for finance-controlled payments.',
    version: 1,
    visibilityMode: 'finance_shared',
    isActive: true,
    formSchema: {
      fieldMasking: {
        bankAccountNumber: {
          enabled: true,
          visibleTo: ['finance', 'admin', 'workflow_related'],
        },
        bankAccountName: {
          enabled: true,
          visibleTo: ['finance', 'admin', 'workflow_related'],
        },
        bankName: {
          enabled: false,
          visibleTo: ['finance', 'admin', 'workflow_related'],
        },
      },
    },
    detailSchema: {
      columns: {
        invoiceDate: { visible: true, required: true },
        invoiceRef: { visible: true, required: true },
        glCode: { visible: true, required: true },
        costCenter: { visible: true, required: true },
        projectCode: { visible: true, required: true },
        expenseTypeCode: { visible: true, required: true },
        currency: { visible: true, required: true },
        exchangeRate: { visible: true, required: true },
        totalAmount: { visible: true, required: false },
        note: { visible: true, required: false },
      },
    },
    attachmentRules: {
      visibilityByType: {
        invoice: {
          sensitive: false,
          visibleTo: ['requester', 'workflow_related', 'finance', 'admin'],
        },
        supporting_document: {
          sensitive: false,
          visibleTo: ['requester', 'workflow_related', 'finance', 'admin'],
        },
        bank_proof: {
          sensitive: true,
          visibleTo: ['finance', 'admin', 'workflow_related'],
        },
        id_document: {
          sensitive: true,
          visibleTo: ['finance', 'admin'],
        },
      },
      requiredTypes: ['invoice', 'bank_proof'],
    },
  },
];

export function cloneDefaultTemplates() {
  return DEFAULT_REQUEST_TEMPLATES.map((template) => ({
    ...template,
    formSchema: structuredClone(template.formSchema),
    detailSchema: structuredClone(template.detailSchema),
    attachmentRules: structuredClone(template.attachmentRules),
  }));
}
