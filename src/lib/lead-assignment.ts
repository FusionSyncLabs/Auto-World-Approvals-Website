export type LeadEmailAssignment = {
  assignedToName: string | null;
  assignedToEmail: string | null;
  assignedListName: string | null;
};

export function assignmentForEmail(contact: { name: string | null; email: string } | null, listName: string | null): LeadEmailAssignment {
  return {
    assignedToName: contact?.name?.trim() || null,
    assignedToEmail: contact?.email || null,
    assignedListName: contact ? listName : null,
  };
}